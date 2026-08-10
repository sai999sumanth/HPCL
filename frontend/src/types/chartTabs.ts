export interface DroppedItem {
  id: string;
  name: string;
  type: string;
  aggregate?: string;
  label?: string;
}
export interface Option {
  value: string;
  label: string;
}

export interface ChartType {
  unique_id: string;
  name: string;
  icon: string; // Changed from ReactNode to string
  hasData?: boolean;
}

export interface FormField {
  default: FormField;
  key: string;
  label: string;
  type: string;
  placeholder?: string;
  options?: string[];
  popover?: {
    [key: string]: any[];
  };
}

export interface ChartForm {
  parameters: FormField[];
}

export interface ChartTabsProps {
  dataset: string;
  chartType: string;
  database: string;
  schema: string;
  mode?: 'ai' | 'default' | 'sql';
  sqlQuery?: string;
  connectionId: string;
  onChartCreated: (chartOptions: any) => void;
  onThemeChange: (theme: string) => void;
  selectedTheme: string;
  onClearChartPreview: () => void;
  initialColumns?: Column[]; // Add this line

}

export interface Column {
  name: string;
  type: string;
}

export interface Dimension {
  id: string;
  name: string;
  type?: string;
}
export interface Metric {
  expression_type: string;
  column: {
    column_name: string;
    type: string;
  };
  aggregate: string;
  label: string;
}

export interface Filter {
  id: string;
  col?: string;
  op?: string;
  val?: string[];
  alias?: string;
  type: string;
}
export interface FormData {
  dimensions?: DroppedItem[];
  metrics?: DroppedItem[];
  x_axis?: DroppedItem[];
  [key: string]: any;
}


export interface ChartMetric {
  expression_type: string;
  column: {
    column_name: string;
    type: string;
  };
  aggregate: string;
  label: string;
  id?: string; // Using id instead of itemId to match your existing pattern
}