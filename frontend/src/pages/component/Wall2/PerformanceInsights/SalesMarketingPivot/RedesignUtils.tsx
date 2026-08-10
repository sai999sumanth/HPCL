import React from "react";
import { ICellRendererParams } from "ag-grid-community";
import { ChevronRight, ChevronDown, Loader2, Plus, Minus } from "lucide-react";
import { TableDataType } from "./DataTypes";

export const getHierarchyColWidth = (key: string): number => {
  const widths: Record<string, number> = {
    cumulative: 180,
    SBU_Name: 200,
    Zone_Name: 160,
    Region_Name: 180,
    SalesArea_Name: 200,
    ProductName: 180,
    month_name: 120,
  };
  return widths[key] || 160;
};

// Color configuration for each drill level
// Level 1 = SBU, Level 2 = Product, Level 3 = Zone, Level 4 = Region, Level 5 = Sales Area, Level 6 = Month
export const levelColors: Record<number, { 
  bg: string; 
  text: string; 
  border: string; 
  iconBg: string; 
  iconBorder: string;
  rowBg: string;  // For row background when expanded/selected
}> = {
  1: { // SBU - Blue
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-l-blue-500',
    iconBg: 'bg-blue-100',
    iconBorder: 'border-blue-400',
    rowBg: '#dbeafe', // blue-100
  },
  2: { // Product - Purple
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-l-purple-500',
    iconBg: 'bg-purple-100',
    iconBorder: 'border-purple-400',
    rowBg: '#f3e8ff', // purple-100
  },
  3: { // Zone - Emerald/Green
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-l-emerald-500',
    iconBg: 'bg-emerald-100',
    iconBorder: 'border-emerald-400',
    rowBg: '#d1fae5', // emerald-100
  },
  4: { // Region - Orange
    bg: 'bg-orange-50',
    text: 'text-orange-800',
    border: 'border-l-orange-500',
    iconBg: 'bg-orange-100',
    iconBorder: 'border-orange-400',
    rowBg: '#ffedd5', // orange-100
  },
  5: { // Sales Area - Cyan
    bg: 'bg-cyan-50',
    text: 'text-cyan-800',
    border: 'border-l-cyan-500',
    iconBg: 'bg-cyan-100',
    iconBorder: 'border-cyan-400',
    rowBg: '#cffafe', // cyan-100
  },
  6: { // Month - Rose/Pink
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-l-rose-500',
    iconBg: 'bg-rose-100',
    iconBorder: 'border-rose-400',
    rowBg: '#ffe4e6', // rose-100
  },
};

export const getLevelColors = (level: number) => {
  return levelColors[level] || levelColors[1];
};

// Get row style based on level - for AG Grid getRowStyle callback
export const getRowStyleByLevel = (params: any) => {
  if (!params.data) return {};
  
  const level = params.data.level;
  const isExpanded = params.data.isExpanded;
  
  // Only apply background color if the row is expanded (has children showing)
  if (isExpanded && levelColors[level]) {
    return { 
      backgroundColor: levelColors[level].rowBg,
    };
  }
  
  return {};
};

export const CumulativeRenderer: React.FC<ICellRendererParams<TableDataType>> = (
  params
) => {
  const { data, context, value } = params;

  if (!data) return null;
  
  // Only show content for level 0 (cumulative row)
  if (data.level !== 0) return null;

  const hasChildren = data.hasChildren;
  // Cumulative uses a neutral/gray color scheme
  const cumulativeColors = {
    text: 'text-slate-700',
    border: 'border-l-slate-400',
  };

  const handleClick = () => {
    if (hasChildren && context?.onToggle) {
      context.onToggle(data);
    }
  };

  return (
    <div
      className={`flex items-center gap-1.5 h-full pl-1 border-l-2 ${cumulativeColors.border}`}
      style={{ 
        cursor: hasChildren ? 'pointer' : 'default',
        lineHeight: '22px',
      }}
      onClick={handleClick}
    >
      <span 
        className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0"
        style={{ minWidth: '14px', minHeight: '14px' }}
      >
        {hasChildren ? (
          data.isExpanded ? (
            <ChevronDown className={`h-3.5 w-3.5 ${cumulativeColors.text}`} />
          ) : (
            <ChevronRight className={`h-3.5 w-3.5 ${cumulativeColors.text}`} />
          )
        ) : null}
      </span>
      <span 
        className={`truncate font-semibold text-[11px] ${cumulativeColors.text}`}
        title={value as string}
        style={{ lineHeight: '22px' }}
      >
        {value}
      </span>
    </div>
  );
};

export const SbuNameRenderer: React.FC<ICellRendererParams<TableDataType>> = (
  params
) => {
  const { data, context, value } = params;

  if (!data) return null;

  // Level 1 = SBU (no indent), Level 2 = Product, Level 3 = Zone, etc.
  const hasChildren = data.hasChildren && data.level < 6;
  // SBU level (1) has no indent, each subsequent level adds 16px
  const paddingLeft = data.level === 1 ? 4 : (data.level - 1) * 16 + 4;
  const colors = getLevelColors(data.level);

  const handleClick = () => {
    if (hasChildren && context?.onToggle) {
      context.onToggle(data);
    }
  };

  return (
    <div
      className={`flex items-center gap-1.5 h-full border-l-2 ${colors.border}`}
      style={{ 
        paddingLeft: `${paddingLeft}px`,
        cursor: hasChildren ? 'pointer' : 'default',
        lineHeight: '22px',
      }}
      onClick={handleClick}
    >
      <span 
        className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0"
        style={{ minWidth: '14px', minHeight: '14px' }}
      >
        {hasChildren ? (
          <span className={`w-3.5 h-3.5 flex items-center justify-center border rounded-sm text-[10px] font-bold leading-none ${colors.iconBg} ${colors.iconBorder} ${colors.text}`}>
            {data.isExpanded ? '−' : '+'}
          </span>
        ) : null}
      </span>
      <span 
        className={`truncate text-[11px] ${colors.text} ${data.level === 1 ? "font-semibold" : "font-medium"}`} 
        title={value as string}
        style={{ lineHeight: '22px' }}
      >
        {value}
      </span>
    </div>
  );
};

export const HierarchyRenderer: React.FC<ICellRendererParams<TableDataType>> = (
  params
) => {
  const { data, context, value } = params;

  if (!data || !value) return null;

  const paddingLeft = data.level * 16 + 4;
  const hasChildren = data.hasChildren && data.level < 5;
  const colors = getLevelColors(data.level + 1); // +1 because hierarchy starts at 0

  const handleClick = () => {
    if (hasChildren && context?.onToggle) {
      context.onToggle(data);
    }
  };

  return (
    <div
      className={`flex items-center gap-1.5 h-full border-l-2 ${colors.border}`}
      style={{ 
        paddingLeft: `${paddingLeft}px`,
        cursor: hasChildren ? 'pointer' : 'default',
        lineHeight: '22px',
      }}
      onClick={handleClick}
    >
      <span 
        className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0"
        style={{ minWidth: '14px', minHeight: '14px' }}
      >
        {hasChildren ? (
          data.isExpanded ? (
            <ChevronDown className={`h-3.5 w-3.5 ${colors.text}`} />
          ) : (
            <ChevronRight className={`h-3.5 w-3.5 ${colors.text}`} />
          )
        ) : null}
      </span>
      <span
        className={`truncate text-[11px] ${colors.text} ${data.level === 0 ? "font-semibold" : "font-medium"}`}
        title={value as string}
        style={{ lineHeight: '22px' }}
      >
        {value}
      </span>
    </div>
  );
};

export const LoadingOverlay: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
    </div>
  );
};
