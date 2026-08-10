export interface ChartData {
  chart_type: string;
  chartData: any[];
  showLegend: boolean;
  legendOrientation: "top" | "bottom" | "left" | "right";
  legendType: "plain" | "scroll";
  chart_request: any;
  showLabelLines: boolean;
  maxValue?: number;
  timeGrain: string;
}

export interface ExistingDashboardDetails {
  groupId: number[];
  groupName: string[];
  organizationId: number; // Added
}

export interface Widget {
  i: string;
  name: string;
  viz_type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  chart_data?: ChartData;
  organizationId?: number; // Added optional for widget-level org context
}

export interface DraggableChartInfo {
  id: string;
  name: string;
  visualization_name: string;
  database?: string;
  schema?: string;
  table?: string;
  organizationId: number; // Added
}

export interface WidgetLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  moved?: any;
  static?: any;
}

export interface SaveDashboardData {
  name: string;
  // groupId: number; 
  // groupName: string;
  organizationId: number; // Added
  group_id: number[]; // Added
  group_name: string[]; // Added
  tags: Array<{
    name: string;
    value: string;
  }>;
}


export interface DashboardData {
  id: string;
  title: string;
  widgets: Widget[];
  layout: WidgetLayout[];
  organizationId: number; // Added
}

export interface AddDashboardProps {
  isEditMode: boolean;
}