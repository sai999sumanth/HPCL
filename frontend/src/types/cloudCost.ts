export interface DataPoint {
    Date: string;
    "Compute Instance(Cost)": number;
    "Compute Instance(Usage)": number;
    "Data Transfer(Cost)": number;
    "Data Transfer(Usage)": number;
    "Storage(Cost)": number;
    "Storage(Usage)": number;
  }
  
  export interface ApiResponse {
    stats: {
      "On Demand": number | string;
      "RI/SP": number | string;
      Spot: number | string;
    };
    cost_summary_by_reservation: any[];
    currency: string;
    resource_types: Record<string, number>;
    instance_types: Record<string, number>;
  }
  
  export interface DayWiseSummary {
    Date: string;
    amount: number;
  }
  export interface TrafficExpense {
    from: Location;
    to: Location;
    cost: string;
    usage: string;
    cloud_type: string;
    currency: string;
  }

  export interface Location {
    name: string;
    latitude: number | null;
    longitude: number | null;
  }

  export interface Resource {
    id: any;
    cred_id: number;
    organization_id: number;
    cloud_provider: string;
    cloud_account_id: string;
    tenant_id: string;
    resource_id: string;
    name: string;
    resource_size: string;
    instance_id: string;
    tags: any[];
    resource_state: string;
    region: string;
    region_name: string;
    created_at: string;
    updated_at: string;
    reservation_type: string;
    cloud_account_name: string | null;
    spends: number | null;
    currency: string | null;
}