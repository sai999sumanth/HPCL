export interface Stage {
    stage: any;
    stage_number: any;
    name: string;
    sap_id: string;
    present_stage: number;
    alert_id: number;
    indent_no?: string;
    product_code?: string;
    dry_out_days: string;
  }
  
  export interface StageCount {
    count: number;
    indices: number[];
  }
  
  export interface StageMap {
    [key: number]: StageCount;
  }
  
  export interface StatusTrackerProps {
    data: Record<string, Stage[]>;
    topLabels: string[];
    bottomLabels: string[];
  }
  
  export interface StatusLineProps {
    stages: Stage[];
    totalStages: number;
  }