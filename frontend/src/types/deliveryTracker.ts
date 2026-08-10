export interface DeliveryData {
  name: string;
  sap_id: string;
  present_stage: number;
  alert_id: number;
  dry_out_days: string;
}

export interface GroupedData {
  [key: string]: DeliveryData[];
}

export interface DeliveryStatusProps {
  data: GroupedData;
  topLabels: string[];
  bottomLabels: string[];
}