export interface TrackerItem {
  name: string;
  sap_id: string;
  present_stage: number;
  alert_id: number;
  indent_no: string;
  product_code: string;
  dry_out_days: string;
}

export interface TrackerData {
  [key: string]: TrackerItem[];
}