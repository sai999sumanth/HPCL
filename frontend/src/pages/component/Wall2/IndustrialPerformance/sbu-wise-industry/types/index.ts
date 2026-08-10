// Updated existing types to include growth property

export interface FilterItem {
  key: string;
  cond: string;
  value: string;
}

export interface ApiPayload {
  filters: FilterItem[];
  cross_filters: any[];
  action: string;
  drill_state: string;
  time_grain: string;
  resp_format: string;
}

export interface ZoneData {
  zone_name: string;
  total_sales: number;
  curr_mkt: number;
  his_mkt: number;
  gain_loss: number;
  growth?: number; // Added growth property
}

export interface RegionData {
  region_name: string;
  total_sales: number;
  curr_mkt: number;
  his_mkt: number;
  gain_loss: number;
  growth?: number; // Added growth property
}

export interface DistrictData {
  district_name: string;
  distname?: string; // Alternative key for backward compatibility
  total_sales: number;
  curr_mkt: number;
  his_mkt: number;
  gain_loss: number;
  growth?: number; // Added growth property
}

export interface ApiResponse {
  status: boolean;
  message: string;
  data: {
    zones?: ZoneData[];
    regions?: RegionData[];
    districts?: DistrictData[];
  };
  file_path: string | null;
}

// New types for the drill-down response
export interface DrilldownMonthlySale {
  month: string;
  fiscal_year: string;
  total_sales: number;
  market_share_percentage: number;
  zones?:any;
}

export interface DrilldownYearlyData {
  Year: string;
  Total_sales: number;
  months: DrilldownMonthlySale[];
}

export interface DrilldownDataPayload {
  status: boolean;
  message: string;
  data: DrilldownYearlyData[];
}

export interface MonthWiseApiResponse {
  status: boolean;
  message: string;
  data: DrilldownDataPayload;
  file_path: string | null;
}

export interface HistoricalDataApiResponse {
  status: boolean;
  message: string;
  data: DrilldownYearlyData[];
  file_path: string | null;
}

export interface HistoricalSalesData {
  year: number;
  month: number;
  monthName: string;
  sales: number;
  market_share_percentage: number;
  zones?:any;
}

export interface TableColumn { 
  key: string;
  label: string;
  type?: 'string' | 'number' | 'percentage' | 'currency';
  format?: (value: any) => string;
  getValue?: (item: any) => any; // Added custom getter function
}

export interface FilterValues {  
  sbu_name: string;
  zone_name: string;
  region_name: string;
  ro?:string;
  statename: string;        
  fiscal_year: string;
  productname: string[];    
  month_name: string;
  coname: string;
  distname: string;
}

