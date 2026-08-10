export interface AlertData {
    id: number;
    unique_id: string;
    device_msg: string;
    district: string;
    sop_id: string;
    alert_section: string;
    alert_history: any[];
    zone: string;
    created_at: string;
    sap_id: string;
    external_id: string;
    last_sms_to: string[];
    region: string;
    updated_at: string;
    interlock_name: string;
    last_mailed_to: string[];
    state: string;
    entity_id: null | string;
    location_name: string;
    interlock_id: string;
    last_escalated_to: string[];
    city: string;
    severity: "Critical" | "High" | "Medium" | "Low";
    device_id: string;
    last_notified_to: string[];
    raw_data: Record<string, any>;
    bu: string;
    alert_status: string;
    device_type: string;
    assigned_to: string;
    alert_state: string;
    device_name: string;
    assigned_to_role: string;
    assigned_user_roles: string;
  }
  
  export interface ApiResponse {
    data: AlertData[];
    total: number;
    page: number;
    limit: number;
  }