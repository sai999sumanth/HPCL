export interface MonthlyPerformance { 
  cur: number; 
  his: number; 
  target: number; 
  diff_value: number | null; 
  target_achieved: number | null; 
}

export interface CumulativePerformance { 
  cur: number; 
  his: number; 
  cumulativeTarget: number; 
  diff_value: number | null; 
  target_achieved: number | null; 
}

export interface SalesData { 
  id: number; 
  region: string; 
  icSalesArea: string;
  Officer: string; 
  monthly: MonthlyPerformance; 
  cumulative: CumulativePerformance; 
}

export interface SalesDataApiResponse { 
  status: boolean; 
  message: string; 
  data: SalesData[]; 
}
export interface RegionApiResponse {
  status: boolean;
  message?: string;
  data: {
    Region_Name: string[];
  };
}

// A generic response type for filter dropdowns
export interface FilterApiResponse {
  status: boolean;
  message?: string;
  data: {
    [key: string]: string[];
  };
}
export interface SalesAreaApiResponse {
  status: boolean;
  message: string;
  data: {
    SalesArea_Name: string[];
  };
}

export interface SelectOption {
  value: string;
  label: string;
}
export interface ExportApiResponse {
  status: boolean;
  file_path?: string;
  link?: string;
  message?: string;
}
