export interface AlertRecord {
  bu: string;
  tt_number: string;
  sap_id: string;
  location_name: string;
  severity: string;
  zone: string;
  instance_level: string;
  instance_status: string;
  violation_type: string;
  maker: string[];
  checker: string[];
  actual_trip_end_date: string;
  novex_alert_created_date: string;
  vehicle_blocked_start_date: string;
  vehicle_blocked_end_date: string;
  alert_id: string;
  id: number;
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
