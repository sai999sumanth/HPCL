export interface Groups {
  id: number;
  name: string;
  description: string;
  organization_id: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_user: string;
  entity_id: null | number;
  group_order: null | number;
  dashboard_order?: null | Dashboard[];
  group_id: number;
}

export interface Dashboard {
  dashboard_id: number;
  display_name: string;
}