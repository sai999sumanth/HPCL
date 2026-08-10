export interface TwoFyRow {
  name: string;
  currentTotal: number;
  prevTotal: number;
  growthPct: number;
}

export interface DistRankRow {
  name:   string;
  region: string;
  total:  number;
  vsAvg:  number;
}

export interface SimpleRow {
  name: string;
  total: number;
}

export interface ParetoRow {
  name: string;
  total: number;
  cumulativePct: number;
  isTop80: boolean;
}

export interface ParetoSummary {
  rows: ParetoRow[];
  totalCount: number;
  top80Count: number;
  top80Sum: number;
  tailCount: number;
  tailSum: number;
  grandTotal: number;
}

export interface RegionSaRow {
  ro: string;
  sa: string;
  total: number;
}

export interface MomRow {
  month: string;
  total: number;
  growth: number;
}

export interface HalfYearRow {
  fiscalYear: string;
  halfYear:   string;
  total:      number;
}

export interface PivotData {
  rows: string[];
  cols: string[];
  cells: Record<string, Record<string, number>>;
  maxVal: number;
}

export const EMPTY_PIVOT: PivotData = { rows: [], cols: [], cells: {}, maxVal: 0 };

export type PAFilterOptions = {
  regions:    string[];
  salesAreas: string[];
  segments:   string[];
  products:   string[];
};

export type PAFilterState = {
  region:    string;
  salesArea: string;
  segment:   string;
  product:   string;
  period:    string;
};
