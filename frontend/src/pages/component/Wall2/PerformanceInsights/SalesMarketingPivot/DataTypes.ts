export interface TableDataType {
  id: string;
  name: string;
  level: number;
  actual: number;
  target: number;
  history: number;
  actVsHist: number;
  actVsTgt: number;
  isExpanded?: boolean;
  hasChildren?: boolean;
  parentId?: string;
  path?: string[];
  cumulative?: string;
  sbuName?: string;
}

export interface ChartData {
  name: string;
  [key: string]: number | string;
}

export type ChartMode = "month" | "year" | "ytd" | "date";

export interface ActiveStates {
  A: boolean;
  H: boolean;
  T: boolean;
  C?: boolean;
}

export interface Filter {
  key: string;
  cond: string;
  value: string;
}

export interface FilterOption {
  key: string;
  cond: string;
  value: string;
}

export interface FilterState {
  SBU_Name: string;
  Zone_Name: string;
  Region_Name: string;
  SalesArea_Name: string;
  ProductName: string;
}
