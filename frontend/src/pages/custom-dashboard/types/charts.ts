export interface ChartData {
  name: string;
  value: number;
  children?: ChartData[];
}

export interface ChartState {
  isMaximized: boolean;
  drillDownPath: string[];
  filters: Record<string, any>;
}

export interface ChartControls {
  onMaximize: () => void;
  onDownload: () => void;
  onDrillDown: (data: ChartData) => void;
  onDrillUp: () => void;
  onFilterChange: (filters: Record<string, any>) => void;
}