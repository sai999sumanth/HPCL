// types.ts

export interface Metric {
    expression_type: string;
    column: {
      column_name: string;
      type: string;
    };
    aggregate: string;
    label: string;
  }
  
 
  export interface DroppedItem {
    id: string;
    name: string;
    type: string;
  }
  

  export interface ChartForm {
    parameters: FormField[];
  }
  
  export interface ChartTabsProps {
    dataset: string;
    chartType: string;
    onChartCreated: (chartOptions: any) => void;
    onThemeChange: (theme: string) => void;
    selectedTheme: string;
    
  }
  
  export interface Option {
    value: string;
    label: string;
  }

  export interface Column {
    name: string;
    type: string;
  }
  
  export interface Dimension {
    alias: string;
    id: string;
    name: string;
    type?: string;
    label?:string;
  }
  export interface x_axis {
    id: string;
    name: string;
    type?: string;
    label?:string;
    
  }

  
  export interface ChartData {
    // Define your chart data structure
    showLegend: boolean;
    legendOrientation: string;
    legendType: string;
    showDataZoom: boolean;
    showLabelLines: boolean;
    // Add other chart data properties
  }
  
  export interface FormData {
    dimensions: Dimension[];
    "x_axis": x_axis;
    // Add other form data properties
  }

  export interface ChartType {
    unique_id: string;
    name: string;
    hasData?: boolean;
    icon?: string;
  }
  
  export interface Column {
    name: string;
    type: string;
  }
  
  export interface ChartForm {
    parameters: FormField[];
  }
  
  export interface FormField {
    key: string;
    label: string;
    type: string;
    placeholder?: string;
    options?: string[];
    popover?: {
      [key: string]: PopoverField[];
    };
  }
  
  export interface PopoverField {
    key: string;
    label: string;
    placeholder?: string;
    options?: string[];
  }
  
  export interface Filter {
    id: string;
    col: string;
    op: string;
    val: string[];
    type: string;
    alias?: string;
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