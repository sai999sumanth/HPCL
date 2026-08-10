export interface Zone {
    name: string;
    id: string;
  }
  
  export interface Plant {
    location_name: string;
    label: string;
    name: string;
    id: string;
  }
  
  export interface LocationResponse {
    status: boolean;
    message: string;
    data: {
      zone: Zone[];
      plant: Plant[];
    };
  }
  
export interface AlertTypeData {
  alert_type: string;
  sop_id: string;
}


