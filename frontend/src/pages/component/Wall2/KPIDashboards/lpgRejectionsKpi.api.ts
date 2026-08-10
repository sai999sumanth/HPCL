/**
 * LPG plant rejections — returned under `data` from
 * `POST /api/lpgoperationsinsights/lpg_plants_insights` with `metric_type: "rejections"`.
 */

export interface LpgRejectionsOverall {
  total_rejections: number;
  cs_rejection: number;
  gd_rejection: number;
  pt_rejection: number;
  /** Trend % (e.g. YoY / period change) — shown in table; click opens day-wise chart. */
  trend_pct: number;
}

export interface LpgRejectionsDailyRow {
  process_date: string;
  total_rejections: number;
  cs_rejection: number;
  gd_rejection: number;
  pt_rejection: number;
}

export interface LpgRejectionsPlantRow {
  sap_id: string;
  location_name: string;
  overall: LpgRejectionsOverall;
  daily: LpgRejectionsDailyRow[];
}

