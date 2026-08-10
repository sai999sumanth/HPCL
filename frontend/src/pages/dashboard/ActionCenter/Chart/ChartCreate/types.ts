import { ReactNode } from 'react';

// Base Interfaces
export interface Row {
  type: 'table' | 'condition';
}

export interface BaseRow {
  type: string;
  id: string;
}

// Table & Join Related Interfaces
export interface TableJoinRow extends BaseRow {
  type: 'table';
  id: string;
  sourceTable: string;
  joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  targetTable: string;
  conditions: {
    sourceColumn: string;
    targetColumn: string;
    operator: string;
    logic: 'AND' | 'OR';
    value: string;
    sourceIsCustom?: boolean;
    targetIsCustom?: boolean;
  }[];
};

interface JoinCondition {
  sourceColumn: string;
  targetColumn: string;
  operator: string;
  logic: 'AND' | 'OR';
  value: string;
  sourceIsCustom?: boolean;
  targetIsCustom?: boolean;
}

export interface JoinConditionRow extends BaseRow {
  type: 'condition';
  joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
}

// Filter Related Interfaces
export interface FilterRow extends BaseRow {
  type: 'filter';
  columns: string[];
  value: string;
}

export interface LogicRow extends BaseRow {
  type: 'logic';
  operator: 'AND' | 'OR';
}

// Schema & Table Interfaces
export interface SchemaOption {
  db: string;
  schema: string;
}

export interface limitOption {
    limit: string;
    offset: string;
  }

export interface TableOption extends SchemaOption {
  table: string;
}

// Sort & Group Related Interfaces
export interface SortRow {
  groupBy: string[];
  orderByColumn: string;
  orderDirection: 'ASC' | 'DESC';
}

export interface DatabaseConnection {
  id: string;
  name: string;
  connection: string;
  database: string;
  schema: string;
  table: string;
  columns: string[];
}

export interface DataSource {
  id: string;
  name: string;
  connection: string;
  database: string;
  schema: string;
  table: string;
  columns: string[];
}

export interface GroupByRow {
  groupBy: string[];
}

export interface OrderByRow {
  column: string;
  direction: 'ASC' | 'DESC';
}

// Having Related Interface
export interface HavingRow {
  id: string;
  aggregateFunction: string;
  columns: string[];
  operator: string;
  value: string;
}

// Constants and Data Structures
export const databaseStructure = {
  4: {
    schemas: {
      public: {
        Customers: ["id", "name", "email", "city"],
        Orders: ["id", "customer_id", "total", "status"],
        Products: ["id", "name", "price", "category"]
      },
      staging: {
        TestCustomers: ["id", "name", "email"],
        TestOrders: ["id", "customer_id", "status"]
      }
    }
  },
  postgres: {
    schemas: {
      hr: {
        Employees: ["id", "name", "department", "salary"],
        Departments: ["id", "name", "location"]
      }
    }
  }
};

export const conditionOperators = [
  { value: '=', label: '=' },
  { value: '<>', label: '≠' },
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '>=', label: '≥' },
  { value: '<=', label: '≤' },
  { value: 'IS NULL', label: 'IS NULL' },
  { value: 'IS NOT NULL', label: 'IS NOT NULL' },
  { value: 'IN', label: 'IN' },
  { value: 'NOT IN', label: 'NOT IN' },
  { value: 'LIKE', label: 'LIKE' },
  { value: 'NOT LIKE', label: 'NOT LIKE' },
  { value: 'BETWEEN', label: 'BETWEEN' }
];

export const aggregateFunctions = [
  { value: 'MIN', label: 'Minimum' },
  { value: 'MAX', label: 'Maximum' },
  { value: 'SUM', label: 'Sum' },
  { value: 'AVG', label: 'Average' },
  { value: 'COUNT', label: 'Count' },
  { value: 'COUNT_DISTINCT', label: 'Count Distinct' }
];

// Enhanced Styles
export const smallTextStyle = {
  '& .MuiTypography-root': { 
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#1a2027',
    letterSpacing: '-0.01em',
    fontFamily: [
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
  '& .MuiInputLabel-root': { 
    fontSize: '0.75rem',
    fontWeight: 500,
    color: '#4b5563',
    transform: 'translate(14px, 9px) scale(1)',
  },
  '& .MuiInputLabel-shrink': {
    transform: 'translate(14px, -6px) scale(0.75)',
  },
  '& .MuiSelect-select': { 
    fontSize: '0.75rem',
    padding: '8px 14px',
    backgroundColor: '#ffffff',
    borderRadius: '6px',
    '&:focus': {
      backgroundColor: '#ffffff',
    }
  },
  '& .MuiMenuItem-root': { 
    fontSize: '0.75rem', 
    minHeight: '32px',
    padding: '6px 14px',
    '&:hover': {
      backgroundColor: '#f3f4f6',
    },
    '&.Mui-selected': {
      backgroundColor: '#e5e7eb',
      '&:hover': {
        backgroundColor: '#d1d5db',
      }
    }
  },
  '& .MuiChip-root': { 
    height: '24px', 
    fontSize: '0.7rem',
    backgroundColor: '#f3f4f6',
    borderRadius: '12px',
    '&:hover': {
      backgroundColor: '#e5e7eb',
    }
  },
  '& .MuiChip-label': { 
    padding: '0 10px',
    fontWeight: 500,
  },
  '& .MuiChip-deleteIcon': {
    fontSize: '16px',
    color: '#6b7280',
    '&:hover': {
      color: '#4b5563',
    }
  },
  '& .MuiTableCell-root': { 
    fontSize: '0.75rem', 
    padding: '8px 14px',
    borderBottom: '1px solid #e5e7eb',
  },
  '& .MuiOutlinedInput-root': { 
    minHeight: '36px',
    backgroundColor: '#ffffff',
    '& fieldset': {
      borderColor: '#e5e7eb',
    },
    '&:hover fieldset': {
      borderColor: '#d1d5db',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#3b82f6',
    }
  },
  '& .MuiOutlinedInput-input': { 
    fontSize: '0.75rem',
    padding: '8px 14px',
  },
};

export const menuProps = {
  PaperProps: {
    style: {
      maxHeight: 240,
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      borderRadius: '6px',
      fontFamily: [
        'Inter',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
      ].join(','),
    }
  },
  MenuListProps: {
    style: {
      padding: '4px',
    }
  }
};

export const selectProps = {
  MenuProps: {
    PaperProps: {
      style: {
        maxHeight: 240,
        fontSize: '0.75rem',
      },
    },
    sx: {
      '& .MuiMenuItem-root': {
        fontSize: '0.75rem',
        py: 0.75,
        px: 1.5,
        minHeight: '32px',
      },
    },
  },
};

export const selectStyles = {
  height: '36px',
  '& .MuiSelect-select': {
    padding: '8px 14px',
    fontSize: '0.75rem',
    backgroundColor: '#ffffff',
    '&:focus': {
      backgroundColor: '#ffffff',
    }
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: '#e5e7eb',
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: '#d1d5db',
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: '#3b82f6',
  }
};

export const sidebarButtonStyle = {
  fontSize: '0.75rem',
  padding: '8px 12px',
  width: '100%',
  justifyContent: 'flex-start',
  marginBottom: '4px',
  textAlign: 'left',
  borderRadius: '6px',
  textTransform: 'none',
  color: '#4b5563',
  backgroundColor: 'transparent',
  transition: 'all 150ms ease',
  fontFamily: 'inherit',
  '&:hover': {
    backgroundColor: '#f3f4f6',
    color: '#1f2937',
  },
  '&.Mui-selected': {
    backgroundColor: '#e5e7eb',
    color: '#1f2937',
    '&:hover': {
      backgroundColor: '#d1d5db',
    }
  },
  '& .MuiButton-startIcon': {
    marginRight: '8px',
    '& > *:nth-of-type(1)': {
      fontSize: '16px'
    }
  }
};

// Additional Component Styles
export const paperStyle = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  border: '1px solid #e5e7eb',
};

export const iconButtonStyle = {
  padding: '6px',
  color: '#6b7280',
  '&:hover': {
    backgroundColor: '#f3f4f6',
    color: '#4b5563',
  }
};

export const buttonBaseStyle = {
  fontSize: '0.75rem',
  padding: '6px 12px',
  textTransform: 'none',
  borderRadius: '6px',
  fontWeight: 500,
  lineHeight: 1.5,
};

export const primaryButtonStyle = {
  ...buttonBaseStyle,
  backgroundColor: '#3b82f6',
  color: '#ffffff',
  '&:hover': {
    backgroundColor: '#2563eb',
  }
};

export const secondaryButtonStyle = {
  ...buttonBaseStyle,
  backgroundColor: '#ffffff',
  color: '#4b5563',
  border: '1px solid #e5e7eb',
  '&:hover': {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
  }
};