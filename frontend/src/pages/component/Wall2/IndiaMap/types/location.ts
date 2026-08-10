 export interface Location {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  color_code?: string;
  sbu?: string;
  state?: string;
  zone?: string;
  district?: string;
  company?: string;
  location_name?: string;
  sap_id?: string;
  [key: string]: any;
}