export interface ScreenItem {
  id: string;
  title: string;
  content: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  x: number;
  y: number;
  w: number;
  h: number;
  isExpanded?: boolean;
  icon?: string;
}

export interface Layout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GridScreen extends ScreenItem {
  isVisible: boolean;
}