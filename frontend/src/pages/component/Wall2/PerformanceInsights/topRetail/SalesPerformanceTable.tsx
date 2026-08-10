import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { apiClient } from '@/services/apiClient';
import { Card, CardHeader, CardTitle, CardContent } from '@/@/components/ui/card';
import { cn } from '@/@/lib/utils';
import {
  ChevronUp,
  ChevronDown,
  Check,
  Loader2,
  AlertTriangle,
  RefreshCw,
  ChevronsUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Search,
  RotateCcw,
  X,
  Download
} from 'lucide-react';
import {
  SalesData,
  SalesAreaApiResponse,
  RegionApiResponse,
  SelectOption,
  MonthlyPerformance,
  CumulativePerformance
} from './index';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/@/components/ui/tooltip';

// --- UTILITY ---
const safeArray = <T,>(data: unknown): T[] => {
  if (Array.isArray(data)) {
    return data;
  }
  return [];
};

const safeNumber = (value: unknown, fallback: number = 0): number => {
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  return fallback;
};

const safeString = (value: unknown, fallback: string = ''): string => {
  if (typeof value === 'string') {
    return value;
  }
  return fallback;
};

const getNestedValue = (obj: any, path: string): any => {
  if (!path) return obj;
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
};

// --- STATIC DATE DATA & HELPERS ---
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const yearOptions: SelectOption[] = [
  { value: '2024-2025', label: '2024-2025' },
  { value: '2025-2026', label: '2025-2026' },
];

const getCurrentFiscalYear = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-11
  return month >= 3 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

const generateMonthOptions = (selectedYear: string): SelectOption[] => {
  const options: SelectOption[] = [];
  const today = new Date();
  const currentCalendarMonth = today.getMonth(); // 0-11
  const currentCalendarYear = today.getFullYear();

  const [startYearStr, endYearStr] = selectedYear.split('-');
  const fiscalStartYear = parseInt(startYearStr, 10);
  const fiscalEndYear = parseInt(endYearStr, 10);

  const currentFiscalYearString = getCurrentFiscalYear();
  const isCurrentFiscalYear = selectedYear === currentFiscalYearString;

  for (let i = 0; i < 12; i++) {
    const monthIndex = (i + 3) % 12;
    const calendarYearForMonth = monthIndex >= 3 ? fiscalStartYear : fiscalEndYear;

    if (isCurrentFiscalYear) {
      if (calendarYearForMonth > currentCalendarYear) continue;
      if (calendarYearForMonth === currentCalendarYear && monthIndex > currentCalendarMonth) continue;
    }

    options.push({
      value: `${monthNames[monthIndex]}-${calendarYearForMonth}`,
      label: monthNames[monthIndex],
    });
  }

  return options;
};

const getDefaultMonthForYear = (year: string): string => {
  const monthOpts = generateMonthOptions(year);
  if (monthOpts.length === 0) {
    return '';
  }

  const isCurrentFY = year === getCurrentFiscalYear();
  if (isCurrentFY) {
    const today = new Date();
    const currentMonthValue = `${monthNames[today.getMonth()]}-${today.getFullYear()}`;
    const currentMonthOption = monthOpts.find(m => m.value === currentMonthValue);
    if (currentMonthOption) {
      return currentMonthOption.value;
    }
  }

  return monthOpts[monthOpts.length - 1].value;
};

// --- ERROR BOUNDARY COMPONENT ---
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Sales Performance Table Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center h-64 p-4 text-center">
          <AlertTriangle className="h-12 w-12 text-red-600 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
          <p className="text-gray-600 mb-4">
            The Sales Performance Table encountered an error. Please refresh the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- UI COMPONENTS ---
const ShadcnSelect = ({
  label,
  value,
  onValueChange,
  options = [],
  disabled = false,
  loading = false,
  placeholder = "Select...",
  selectAllValue,
  error = false,
  searchable = false,
  customDisplayLabel
}: {
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  selectAllValue?: string;
  error?: boolean;
  searchable?: boolean;
  customDisplayLabel?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const safeOptions = useMemo(() => safeArray<SelectOption>(options), [options]);

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchTerm) {
      return safeOptions;
    }
    return safeOptions.filter(opt =>
      opt.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [safeOptions, searchTerm, searchable]);

  const selectedLabel = customDisplayLabel || safeOptions.find(opt => opt.value === value)?.label || placeholder;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const buttonClassName = cn(
    "flex h-8 w-full items-center justify-between rounded-md border px-2 py-1 text-xs ring-offset-background placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
    error ? "border-red-500 bg-red-50" : "border-gray-300 bg-white"
  );

  return (
    <div className="w-full sm:w-40" ref={ref}>
      {label && (
        <label className={cn(
          "text-xs font-medium mb-1 block",
          error ? "text-red-600" : "text-gray-600"
        )}>
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && !loading && setIsOpen(!isOpen)}
          disabled={disabled || loading}
          className={buttonClassName}
        >
          {loading ? (
            <div className="flex items-center">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Loading...
            </div>
          ) : error ? (
            <div className="flex items-center text-red-600">
              <AlertTriangle className="mr-1 h-3 w-3" />
              Error
            </div>
          ) : (
            <span className="truncate text-xs">{selectedLabel}</span>
          )}
          {!loading && !error && (
            isOpen ? <ChevronUp className="h-3 w-3 opacity-50 flex-shrink-0" /> : <ChevronDown className="h-3 w-3 opacity-50 flex-shrink-0" />
          )}
        </button>
        {isOpen && !error && (
          <div className="absolute z-20 w-full mt-1 rounded-md border bg-white shadow-md">
            {searchable && (
              <div className="relative p-2 border-b">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full pl-8 pr-2 py-1 text-xs border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
            <ul className="max-h-48 overflow-auto p-1">
              {filteredOptions.length > 0 ? filteredOptions.map(opt => {
                const isSelected = (value === selectAllValue && selectAllValue !== undefined) || value === opt.value;
                return (
                  <li
                    key={opt.value}
                    onClick={() => {
                      onValueChange(opt.value);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-6 pr-2 text-xs font-normal outline-none hover:bg-gray-100"
                  >
                    {isSelected && <span className="absolute left-1 flex h-3.5 w-3.5 items-center justify-center"><Check className="h-3 w-3" /></span>}
                    {opt.label}
                  </li>
                );
              }) : (
                <li className="text-center text-xs text-gray-500 py-2">No results found.</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

// --- MULTISELECT COMPONENT WITH APPLY BUTTON ---
interface MultiSelectWithApplyProps {
  label?: string;
  value: string[];
  onValueChange: (value: string[]) => void;
  onApply: (values: string[]) => void;
  options: SelectOption[];
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  error?: boolean;
  searchable?: boolean;
  maxDisplayItems?: number;
  selectAllValue?: string;
  hasChanges?: boolean;
}

const MultiSelectWithApply: React.FC<MultiSelectWithApplyProps> = ({
  label,
  value = [],
  onValueChange,
  onApply,
  options = [],
  disabled = false,
  loading = false,
  placeholder = "Select...",
  error = false,
  searchable = false,
  maxDisplayItems = 2,
  selectAllValue,
  hasChanges = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [tempSelection, setTempSelection] = useState<string[]>(value);
  const ref = useRef<HTMLDivElement>(null);

  const safeOptions = useMemo(() => Array.isArray(options) ? options : [], [options]);

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchTerm) {
      return safeOptions;
    }
    return safeOptions.filter(opt =>
      opt.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [safeOptions, searchTerm, searchable]);

  const isAllSelected = useMemo(() =>
    selectAllValue ? tempSelection.includes(selectAllValue) : false,
    [tempSelection, selectAllValue]
  );

  const hasAllOption = selectAllValue && safeOptions.some(opt => opt.value === selectAllValue);

  // Update temp selection when value changes from outside
  useEffect(() => {
    setTempSelection(value);
  }, [value]);

  const getDisplayText = () => {
    if (loading) return "Loading...";
    if (error) return "Error";
    if (value.length === 0) return placeholder;

    if (value.includes(selectAllValue || '')) {
      return "All Sales Areas";
    }

    const nonAllValues = value.filter(v => v !== selectAllValue);
    if (nonAllValues.length === 0) return placeholder;
    if (nonAllValues.length === 1) {
      const option = safeOptions.find(opt => opt.value === nonAllValues[0]);
      return option?.label || nonAllValues[0];
    }
    if (nonAllValues.length <= maxDisplayItems) {
      return nonAllValues
        .map(v => safeOptions.find(opt => opt.value === v)?.label || v)
        .join(', ');
    }
    return `${nonAllValues.length} selected`;
  };

  const handleToggle = (optionValue: string) => {
    let newSelected: string[];

    if (optionValue === selectAllValue) {
      if (isAllSelected) {
        newSelected = [];
      } else {
        newSelected = safeOptions.map(o => o.value);
      }
    } else {
      let currentSelection = [...tempSelection];
      if (currentSelection.includes(optionValue)) {
        newSelected = currentSelection.filter(v => v !== optionValue && v !== selectAllValue);
      } else {
        newSelected = [...currentSelection, optionValue];
      }

      const allIndividualOptions = safeOptions.filter(o => o.value !== selectAllValue);
      if (allIndividualOptions.length > 0 && allIndividualOptions.every(o => newSelected.includes(o.value))) {
        if (!newSelected.includes(selectAllValue!)) {
          newSelected.push(selectAllValue!);
        }
      } else {
        newSelected = newSelected.filter(v => v !== selectAllValue);
      }
    }
    setTempSelection(newSelected);
  };

  const handleApply = () => {
    onValueChange(tempSelection);
    onApply(tempSelection);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleCancel = () => {
    setTempSelection(value);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTempSelection([]);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setTempSelection(value); // Reset to original value
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  const buttonClassName = cn(
    "flex h-8 w-full items-center justify-between rounded-md border px-2 py-1 text-xs ring-offset-background placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
    error ? "border-red-500 bg-red-50" : hasChanges ? "border-orange-400 bg-orange-50" : "border-gray-300 bg-white"
  );

  return (
    <div className="w-full sm:w-40" ref={ref}>
      {label && (
        <label className={cn(
          "text-xs font-medium mb-1 block",
          error ? "text-red-600" : hasChanges ? "text-orange-600" : "text-gray-600"
        )}>
          {label}
          {hasChanges && <span className="ml-1 text-orange-500">*</span>}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && !loading && setIsOpen(!isOpen)}
          disabled={disabled || loading}
          className={buttonClassName}
        >
          {loading ? (
            <div className="flex items-center">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Loading...
            </div>
          ) : error ? (
            <div className="flex items-center text-red-600">
              <AlertTriangle className="mr-1 h-3 w-3" />
              Error
            </div>
          ) : (
            <div className="flex items-center flex-1 min-w-0">
              <span className="truncate text-xs flex-1">{getDisplayText()}</span>
              {value.length > 0 && !loading && !error && (
                <button
                  onClick={handleClearAll}
                  className="ml-1 hover:bg-gray-200 rounded p-0.5"
                  title="Clear all"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
          {!loading && !error && (
            isOpen ? <ChevronUp className="h-3 w-3 opacity-50 flex-shrink-0 ml-1" /> : <ChevronDown className="h-3 w-3 opacity-50 flex-shrink-0 ml-1" />
          )}
        </button>
        {isOpen && !error && (
          <div className="absolute z-20 w-64 mt-1 rounded-md border bg-white shadow-lg">
            {searchable && (
              <div className="relative p-2 border-b">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full pl-8 pr-2 py-1 text-xs border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
            <ul className="max-h-48 overflow-auto p-1">
              {filteredOptions.length > 0 ? (
                <>
                  {hasAllOption && (
                    <li
                      onClick={() => handleToggle(selectAllValue!)}
                      className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-xs font-medium outline-none hover:bg-gray-100 border-b"
                    >
                      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                        <input
                          type="checkbox"
                          className="h-3 w-3"
                          checked={isAllSelected}
                          readOnly
                        />
                      </span>
                      Select All
                    </li>
                  )}

                  {filteredOptions.filter(opt => opt.value !== selectAllValue).map(opt => {
                    const isSelected = isAllSelected || tempSelection.includes(opt.value);
                    return (
                      <li
                        key={opt.value}
                        onClick={() => handleToggle(opt.value)}
                        className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-xs font-normal outline-none hover:bg-gray-100"
                      >
                        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                          <input
                            type="checkbox"
                            className="h-3 w-3"
                            checked={isSelected}
                            readOnly
                          />
                        </span>
                        {opt.label}
                      </li>
                    );
                  })}
                </>
              ) : (
                <li className="text-center text-xs text-gray-500 py-2">No results found.</li>
              )}
            </ul>

            {/* Apply/Cancel buttons */}
            <div className="flex items-center justify-end gap-2 p-2 border-t bg-gray-50">
              <button
                onClick={handleCancel}
                className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- COMPACT PAGINATION COMPONENT ---
const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  totalItems
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage: number;
  totalItems: number;
}) => {
  const getVisiblePages = () => {
    const pages = [];
    const maxVisible = 3;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      if (!pages.includes(totalPages)) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const startItem = totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 border-t text-xs">
      <div className="text-gray-600 hidden sm:block">
        {startItem}-{endItem} of {totalItems}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-3 w-3" />
          <span className="hidden sm:inline">Prev</span>
        </button>

        <div className="flex items-center gap-1">
          {getVisiblePages().map((page, index) => (
            <React.Fragment key={index}>
              {page === '...' ? (
                <span className="px-2 py-1 text-xs">
                  <MoreHorizontal className="h-3 w-3" />
                </span>
              ) : (
                <button
                  onClick={() => onPageChange(page as number)}
                  className={cn(
                    "px-2 py-1 text-xs border rounded min-w-[24px] h-6",
                    currentPage === page
                      ? "bg-blue-600 text-white border-blue-600"
                      : "hover:bg-gray-100"
                  )}
                >
                  {page}
                </button>
              )}
            </React.Fragment>
          ))}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || totalPages === 0}
          className="flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      <div className="text-gray-600 sm:hidden">
        Page {currentPage} of {totalPages}
      </div>
    </div>
  );
};

// --- HELPER COMPONENTS & FUNCTIONS ---
const PercentageCell = ({ value }: { value: number | null | undefined }) => {
  if (value === null || typeof value === 'undefined' || isNaN(value)) {
    return <span className="text-gray-500">N/A</span>;
  }
  const isNegative = value < 0;
  const colorClass = isNegative ? 'text-red-600' : 'text-green-600';
  return <span className={cn('font-medium', colorClass)}>{value.toFixed(2)}%</span>;
};

const ErrorDisplay = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <div className="flex flex-col items-center justify-center h-64 p-4 text-center bg-red-50 rounded-lg border border-red-200">
    <AlertTriangle className="h-12 w-12 text-red-600 mb-4" />
    <h3 className="text-lg font-semibold mb-2 text-red-600">Error Loading Data</h3>
    <p className="text-gray-600 mb-4 max-w-md">
      {message}
    </p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        <RefreshCw className="h-4 w-4" />
        Try Again
      </button>
    )}
  </div>
);

const NoDataDisplay = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center h-64 p-4 text-center bg-blue-50 rounded-lg border border-blue-200">
    <div className="h-12 w-12 text-blue-600 mb-4 rounded-full bg-blue-100 flex items-center justify-center">
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    </div>
    <h3 className="text-lg font-semibold mb-2 text-blue-700">No Data Available</h3>
    <p className="text-gray-600 max-w-md">
      {message}
    </p>
  </div>
);

// --- MAIN COMPONENT ---
type SortDirection = 'asc' | 'desc';
type SortKey = keyof Omit<SalesData, 'monthly' | 'cumulative'> | `monthly.${keyof MonthlyPerformance}` | `cumulative.${keyof CumulativePerformance}`;

const SalesPerformanceTableCore: React.FC = () => {
  const [data, setData] = useState<SalesData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [noDataMessage, setNoDataMessage] = useState<string | null>(null);

  const [selectedYear, setSelectedYear] = useState<string>(getCurrentFiscalYear());
  const [monthOptions, setMonthOptions] = useState<SelectOption[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getDefaultMonthForYear(getCurrentFiscalYear()));

  // Region state
  const [regions, setRegions] = useState<SelectOption[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(true);
  const [regionsError, setRegionsError] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState('All');

  // Sales Area state with apply functionality
  const [salesAreas, setSalesAreas] = useState<SelectOption[]>([]);
  const [salesAreasLoading, setSalesAreasLoading] = useState(true);
  const [salesAreasError, setSalesAreasError] = useState<string | null>(null);
  const [selectedSalesAreas, setSelectedSalesAreas] = useState<string[]>([]);
  const [appliedSalesAreas, setAppliedSalesAreas] = useState<string[]>([]);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Refetch trigger
  const [retryToggle, setRetryToggle] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const [sortKey, setSortKey] = useState<SortKey>('id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);
  const salesAreasLoadedForRegion = useRef<string | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const handleReset = () => {
    const defaultYear = getCurrentFiscalYear();
    const defaultMonth = getDefaultMonthForYear(defaultYear);

    setSelectedYear(defaultYear);
    setSelectedMonth(defaultMonth);
    setSelectedRegion('All');
    setCurrentPage(1);
    setRetryToggle(p => !p);
  };

  const handleSalesAreaApply = (values: string[]) => {
    setAppliedSalesAreas(values);
    setCurrentPage(1);
  };

  const handleRegionClick = (regionName: string) => {
    if (regionName && regionName !== 'N/A') {
      setSelectedRegion(regionName);
      setCurrentPage(1);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);

    try {
      const filters = [
        { key: '"Zone_Name"', cond: 'equals', value: 'All' },
        { key: '"fiscal_year"', cond: "equals", value: selectedYear },
        { key: '"month_name"', cond: "equals", value: selectedMonth.split('-')[0] }
      ];

      if (selectedRegion !== 'All') {
        filters.push({ key: '"Region_Name"', cond: "in", value: selectedRegion });
      }

      const activeSalesAreas = appliedSalesAreas.filter(sa => sa !== 'All');
      if (activeSalesAreas.length > 0) {
        filters.push({ key: '"SalesArea_Name"', cond: "in", value: activeSalesAreas.join(',') });
      }

      const payload = {
        action: "m60_performance",
        cross_filters: [],
        drill_state: "",
        filters: filters,
        resp_format: "file_download",
        time_grain: ""
      };

      const response = await apiClient.post<any>('/api/charts/generate_vis_data', payload);
      const responseData = response?.data;


      if (responseData?.file_path && typeof responseData.file_path === 'string') {
        const downloadUrl = `${window.location.origin}${responseData.file_path}`;
        window.open(downloadUrl, '_blank');
      } else if (responseData?.link && typeof responseData.link === 'string') {
        window.open(responseData.link, '_blank');
      } else if (responseData && typeof responseData === 'string' && responseData.startsWith('http')) {
        window.open(responseData, '_blank');
      } else {
        console.error('Unhandled export response:', responseData);
        setExportError('Export failed. The server response was not a valid download link.');
      }

    } catch (err: any) {
      console.error('Export API error:', err);
      setExportError(err.message || 'An unexpected error occurred during export.');
    } finally {
      setIsExporting(false);
    }
  };



  const safeData = useMemo(() => safeArray<SalesData>(data), [data]);

  // Log the region data
  const regionsData = Array.from(new Set(safeData.map(row => row.region)));


  const sortedData = useMemo(() => {
    if (!sortKey) return safeData;

    return [...safeData].sort((a, b) => {
      const valA = getNestedValue(a, sortKey);
      const valB = getNestedValue(b, sortKey);
      const order = sortDirection === 'asc' ? 1 : -1;

      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * order;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return valA.localeCompare(valB) * order;
      }

      return 0;
    });
  }, [safeData, sortKey, sortDirection]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const paginatedData = sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    tableContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getRegionDisplayLabel = () => {
    if (selectedRegion === 'All' && regions.length > 1) {
      return 'All Regions';
    }
    return undefined;
  };

  const hasSalesAreaChanges = useMemo(() => {
    if (selectedSalesAreas.length !== appliedSalesAreas.length) return true;
    const selectedSet = new Set(selectedSalesAreas);
    const appliedSet = new Set(appliedSalesAreas);
    if (selectedSet.size !== appliedSet.size) return true;
    for (const area of selectedSet) {
      if (!appliedSet.has(area)) return true;
    }
    return false;
  }, [selectedSalesAreas, appliedSalesAreas]);

  // Effect to update month options when year changes
  useEffect(() => {
    const newMonths = generateMonthOptions(selectedYear);
    setMonthOptions(newMonths);

    if (isInitialMount.current) {
      setSelectedMonth(getDefaultMonthForYear(selectedYear));
    } else {
      setSelectedMonth(currentMonth => {
        const isMonthStillValid = newMonths.some(m => m.value === currentMonth);
        return isMonthStillValid ? currentMonth : getDefaultMonthForYear(selectedYear);
      });
    }

    setCurrentPage(1);
  }, [selectedYear]);

  // Effect to fetch main data
  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      // Guard 1: Don't fetch if dependent dropdowns are still loading their options.
      if (regionsLoading) {
        return;
      }

      // Guard 2: Don't fetch if filter values are not yet set.
      if (!selectedYear || !selectedMonth) {
        return;
      }

      // Guard 3: Check if the currently selected month is valid for the currently selected year.
      const currentValidMonths = generateMonthOptions(selectedYear);
      if (!currentValidMonths.some(m => m.value === selectedMonth)) {
        return;
      }

      // Guard 4: Wait for sales areas to load for the selected region before fetching data
      if (salesAreasLoadedForRegion.current !== selectedRegion) {
        return;
      }

      setLoading(true);
      setError(null);
      setNoDataMessage(null);
      setExportError(null);

      try {
        const filters = [
          { key: '"Zone_Name"', cond: 'equals', value: 'All' },
          { key: '"fiscal_year"', cond: "equals", value: selectedYear },
          { key: '"month_name"', cond: "equals", value: selectedMonth.split('-')[0] }
        ];

        if (selectedRegion !== 'All') {
          filters.push({ key: '"Region_Name"', cond: "in", value: selectedRegion });
        }

        const activeSalesAreas = appliedSalesAreas.filter(sa => sa !== 'All');
        if (activeSalesAreas.length > 0) {
          filters.push({ key: '"SalesArea_Name"', cond: "in", value: activeSalesAreas.join(',') });
        }

        const payload = {
          action: "m60_performance",
          cross_filters: [],
          drill_state: "",
          filters: filters,
          resp_format: "top_ic",
          time_grain: ""
        };

        const response = await apiClient.post<any>('/api/charts/generate_vis_data', payload, { signal: controller.signal });
        const responseData = response?.data;

        if (responseData?.status && responseData?.data) {
          const salesData = safeArray<SalesData>(responseData.data);
          setData(salesData);
          setError(null);

          if (salesData.length === 0) {
            const salesAreaText = appliedSalesAreas.includes('All') || appliedSalesAreas.length === 0 ? '' : ` - ${appliedSalesAreas.join(', ')}`;
            setNoDataMessage(`No sales data found for ${selectedMonth.split('-')[0]} ${selectedYear}${selectedRegion !== 'All' ? ` in ${selectedRegion}` : ''}${salesAreaText}.`);
          } else {
            setNoDataMessage(null);
          }

          if (currentPage > Math.ceil(salesData.length / itemsPerPage)) {
            setCurrentPage(1);
          }
        } else if (Array.isArray(responseData) && responseData.length === 2 && responseData[0] === false) {
          setNoDataMessage(safeString(responseData[1], 'No data for current selection'));
          setData([]);
        } else {
          const apiMessage = responseData?.message || 'No data available for the selected criteria';
          setNoDataMessage(apiMessage);
          setData([]);
        }
      } catch (err: any) {
        if (err.name === 'CanceledError' || err.name === 'AbortError') {
          return;
        }
        if (err.response?.status === 404 || err.message?.toLowerCase().includes('no data')) {
          setNoDataMessage('No data available for the selected filters. Please try different criteria.');
        } else {
          const errorMessage = err.message || 'Failed to fetch data. Please try again later.';
          setError(errorMessage);
          console.error('Fetch data error:', err);
        }
        setData([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      controller.abort();
    }
  }, [selectedYear, selectedMonth, selectedRegion, appliedSalesAreas, currentPage, regionsLoading, retryToggle]);

  // Effect to fetch Regions on initial mount
// Effect to fetch Regions on initial mount
useEffect(() => {
  const fetchRegions = async () => {
    setRegionsLoading(true);
    setRegionsError(null);
    try {
      const payload = {
        column: ['Region_Name'],
        connection_id: "1",
        schema: "public",
        table: "MOM_DAY_LEVEL_DATA",
        where_cond: [
          { key: "Zone_Name", value: "-", cond: "!=" },
          { key: "Zone_Name", value: "", cond: "!=" },
          { key: "SBU_Name", value: "0", cond: "!=" },
          { key: "SBU_Name", value: "I&C", cond: "=" }
        ]
      };
      const response = await apiClient.post<RegionApiResponse>('/api/charts/get_distinct_values', payload);
      if (response?.data?.status && response.data.data) {
        const list = safeArray<string>(response.data.data.Region_Name);
        // Filter out "mumbai lubes ro" (case insensitive)
        const filteredList = list.filter(region => 
          region && region.toLowerCase() !== 'mumbai lubes ro'&&
          region.toLowerCase() !== 'lubes hqo - base oil'
        );
        const uniqueList = [...new Set(filteredList)].filter(Boolean);
        setRegions([{ value: 'All', label: 'All' }, ...uniqueList.map(r => ({ value: r, label: r }))]);
      } else {
        throw new Error(response?.data?.message || 'Invalid response format for Regions');
      }
    } catch (err: any) {
      setRegionsError(err.message || `Failed to load Regions`);
      setRegions([{ value: 'All', label: 'All' }]);
    } finally {
      setRegionsLoading(false);
    }
  };

  fetchRegions();
}, []);

  // Effect to fetch Sales Areas when Region changes
  useEffect(() => {
    if (!selectedRegion) {
      setSalesAreas([]);
      setSelectedSalesAreas([]);
      setAppliedSalesAreas([]);
      salesAreasLoadedForRegion.current = null;
      return;
    };

    const fetchSalesAreas = async (region: string) => {
      setSalesAreasLoading(true);
      setSalesAreasError(null);
      salesAreasLoadedForRegion.current = null;

      try {
        const where_cond = [
          { key: "Zone_Name", value: "-", cond: "!=" },
          { key: "Zone_Name", value: "", cond: "!=" },
          { key: "SBU_Name", value: "0", cond: "!=" },
          { key: "SBU_Name", value: "I&C", cond: "=" }
        ];

        if (region && region !== 'All') {
          where_cond.push({ key: 'Region_Name', value: region, cond: "=" });
        }

        const payload = {
          column: ["SalesArea_Name"],
          connection_id: "1",
          schema: "public",
          table: "MOM_DAY_LEVEL_DATA",
          where_cond: where_cond,
        };
        const response = await apiClient.post<SalesAreaApiResponse>('/api/charts/get_distinct_values', payload);
        if (response?.data?.status && response.data.data) {
          const list = safeArray<string>(response.data.data.SalesArea_Name);
          const uniqueList = [...new Set(list)].filter(Boolean);
          const salesAreaOptions = [{ value: 'All', label: 'All' }, ...uniqueList.map(sa => ({ value: sa, label: sa }))];
          setSalesAreas(salesAreaOptions);

          const allValues = salesAreaOptions.map(o => o.value);
          setSelectedSalesAreas(allValues);
          setAppliedSalesAreas(allValues);
        } else {
          throw new Error(response?.data?.message || 'Invalid response format for Sales Areas');
        }
      } catch (err: any) {
        setSalesAreasError(err.message || `Failed to load Sales Areas`);
        setSalesAreas([{ value: 'All', label: 'All' }]);
        setSelectedSalesAreas(['All']);
        setAppliedSalesAreas(['All']);
      } finally {
        salesAreasLoadedForRegion.current = region;
        setSalesAreasLoading(false);
      }
    };

    fetchSalesAreas(selectedRegion);
  }, [selectedRegion]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
    }
  }, []);

  const SortableTH = ({ children, sortKey: thSortKey, className, isNumeric = false, ...props }: { children: React.ReactNode; sortKey: SortKey; className?: string; isNumeric?: boolean } & React.ThHTMLAttributes<HTMLTableCellElement>) => {
    const isActive = sortKey === thSortKey;
    const Icon = isActive ? (sortDirection === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown;
    return (
      <th className={cn('p-2 align-middle whitespace-nowrap cursor-pointer transition-colors hover:bg-gray-100', className)} onClick={() => handleSort(thSortKey)} {...props}>
        <div className={cn('flex items-center gap-1.5', isNumeric ? 'justify-end' : 'justify-start')}>
          {children}
          <Icon className={cn('h-3 w-3 flex-shrink-0', !isActive && 'opacity-30')} />
        </div>
      </th>
    );
  };

  const isDataLoading = loading || regionsLoading || salesAreasLoading;

  return (
    <Card className="w-full max-w-full mx-auto flex flex-col h-[90vh]">
      <CardHeader className="pb-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <CardTitle className="text-xl">I&C Sales Performance Report</CardTitle>

          <div className="flex flex-wrap items-center gap-2">
            <ShadcnSelect
              value={selectedYear}
              onValueChange={setSelectedYear}
              options={yearOptions}
              placeholder="Year..."
              disabled={isDataLoading}
            />
            <ShadcnSelect
              value={selectedMonth}
              onValueChange={(value) => {
                setSelectedMonth(value);
                setCurrentPage(1);
              }}
              options={monthOptions}
              disabled={!selectedYear || monthOptions.length === 0 || isDataLoading}
              placeholder="Month..."
            />
            <ShadcnSelect
              value={selectedRegion}
              onValueChange={(value) => {
                setSelectedRegion(value);
                setCurrentPage(1);
              }}
              options={regions}
              loading={regionsLoading}
              error={!!regionsError}
              placeholder="Region..."
              selectAllValue="All"
              searchable={true}
              customDisplayLabel={getRegionDisplayLabel()}
              disabled={isDataLoading}
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <MultiSelectWithApply
                    value={selectedSalesAreas}
                    onValueChange={setSelectedSalesAreas}
                    onApply={handleSalesAreaApply}
                    options={salesAreas}
                    loading={salesAreasLoading}
                    error={!!salesAreasError}
                    placeholder="Sales Area..."
                    selectAllValue="All"
                    searchable={true}
                    disabled={isDataLoading || !selectedRegion || selectedRegion === 'All'} // CHANGED: Added selectedRegion === 'All'
                    hasChanges={hasSalesAreaChanges}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  {(!selectedRegion || selectedRegion === 'All') && "Select region first"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <button
              onClick={handleExport}
              disabled={isDataLoading || isExporting || data.length === 0}
              className="flex items-center justify-center h-8 px-3 border rounded text-sm bg-green-600 text-white hover:bg-green-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-400"
              title="Export Data"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </>
              )}
            </button>
            <button
              onClick={handleReset}
              className="flex items-center justify-center h-8 w-8 p-0 border rounded text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              title="Reset Filters"
              disabled={isDataLoading}
            >
              <RotateCcw className={cn("h-4 w-4", isDataLoading && "animate-spin")} />
            </button>
          </div>
        </div>

        {(regionsError || salesAreasError || exportError) && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-md">
            {regionsError && <p className="text-sm text-red-600">Regions failed to load: {regionsError}</p>}
            {salesAreasError && <p className="text-sm text-red-600">Sales areas failed to load: {salesAreasError}</p>}
            {exportError && <p className="text-sm text-red-600">{exportError}</p>}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-grow overflow-hidden flex flex-col p-0">
        {isDataLoading && !data.length ? (
          <div className="flex-grow flex justify-center items-center">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-gray-600">Loading performance data...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex-grow flex justify-center items-center p-4">
            <ErrorDisplay message={error} onRetry={() => setRetryToggle(p => !p)} />
          </div>
        ) : noDataMessage ? (
          <div className="flex-grow flex justify-center items-center p-4">
            <NoDataDisplay message={noDataMessage} />
          </div>
        ) : (
          <>
            <div className="overflow-auto flex-grow" ref={tableContainerRef}>
              <table className="w-full caption-bottom text-xs">
                <thead className="sticky top-0 border-b bg-gray-50 z-10">
                  <tr className="border-b">
                    <SortableTH sortKey="id" rowSpan={2} className="h-20 font-semibold text-gray-900 text-left">S.No</SortableTH>
                    <SortableTH sortKey="region" rowSpan={2} className="h-20 font-semibold text-gray-900 text-left">Region</SortableTH>
                    <SortableTH sortKey="icSalesArea" rowSpan={2} className="h-20 font-semibold text-gray-900 text-left">IC Sales Area</SortableTH>
                    <SortableTH sortKey="Officer" rowSpan={2} className="h-20 font-semibold text-gray-900 text-left">Sales Officer</SortableTH>
                    <th colSpan={5} className="p-2 text-center align-middle font-semibold text-gray-900 border-l">Monthly Performance</th>
                    <th colSpan={5} className="p-2 text-center align-middle font-semibold text-gray-900 border-l">Cumulative Performance</th>
                  </tr>
                  <tr className="border-b">
                    <SortableTH sortKey="monthly.cur" isNumeric={true} className="h-10 font-medium text-gray-600 border-l">CUR</SortableTH>
                    <SortableTH sortKey="monthly.his" isNumeric={true} className="h-10 font-medium text-gray-600 border-l">HIS</SortableTH>
                    <SortableTH sortKey="monthly.diff_value" isNumeric={true} className="h-10 font-medium text-gray-600 border-l">% Diff.</SortableTH>
                    <SortableTH sortKey="monthly.target" isNumeric={true} className="h-10 font-medium text-gray-600 border-l">Target</SortableTH>
                    <SortableTH sortKey="monthly.target_achieved" isNumeric={true} className="h-10 font-medium text-gray-600 border-l">% Target Ach.</SortableTH>
                    <SortableTH sortKey="cumulative.cur" isNumeric={true} className="h-10 font-medium text-gray-600 border-l">CUR</SortableTH>
                    <SortableTH sortKey="cumulative.his" isNumeric={true} className="h-10 font-medium text-gray-600 border-l">HIS</SortableTH>
                    <SortableTH sortKey="cumulative.diff_value" isNumeric={true} className="h-10 font-medium text-gray-600 border-l">% Diff.</SortableTH>
                    <SortableTH sortKey="cumulative.cumulativeTarget" isNumeric={true} className="h-10 font-medium text-gray-600 border-l">Cum. Target</SortableTH>
                    <SortableTH sortKey="cumulative.target_achieved" isNumeric={true} className="h-10 font-medium text-gray-600 border-l">% Target Ach.</SortableTH>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {paginatedData.map((row) => {
                    const safeRow = {
                      id: safeNumber(row.id, 0),
                      region: safeString(row.region, 'N/A'),
                      icSalesArea: safeString(row.icSalesArea, 'N/A'),
                      Officer: safeString(row.Officer, 'N/A'),
                      monthly: {
                        cur: safeNumber(row.monthly?.cur, 0),
                        his: safeNumber(row.monthly?.his, 0),
                        target: safeNumber(row.monthly?.target, 0),
                        diff_value: row.monthly?.diff_value,
                        target_achieved: row.monthly?.target_achieved
                      },
                      cumulative: {
                        cur: safeNumber(row.cumulative?.cur, 0),
                        his: safeNumber(row.cumulative?.his, 0),
                        cumulativeTarget: safeNumber(row.cumulative?.cumulativeTarget, 0),
                        diff_value: row.cumulative?.diff_value,
                        target_achieved: row.cumulative?.target_achieved
                      }
                    };
                    const isRegionClickable = safeRow.region !== 'N/A' && regions.some(r => r.value === safeRow.region);
                    return (
                      <tr key={safeRow.id} className="border-b transition-colors hover:bg-gray-50">
                        <td className="p-2 align-middle font-medium">{safeRow.id}</td>
                        <td
                          className={cn(
                            "p-2 align-middle text-left",
                            isRegionClickable && "cursor-pointer text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                          )}
                          onClick={() => isRegionClickable && handleRegionClick(safeRow.region)}
                          title={isRegionClickable ? `Click to filter by ${safeRow.region}` : ''}
                        >
                          {safeRow.region}
                        </td>
                        <td className="p-2 align-middle text-left">{safeRow.icSalesArea}</td>
                        <td className="p-2 align-middle text-left font-medium text-blue-600">{safeRow.Officer}</td>
                        <td className="p-2 align-middle text-right">{safeRow.monthly.cur.toFixed(2)}</td>
                        <td className="p-2 align-middle text-right">{safeRow.monthly.his.toFixed(2)}</td>
                        <td className="p-2 align-middle text-right"><PercentageCell value={safeRow.monthly.diff_value} /></td>
                        <td className="p-2 align-middle text-right">{safeRow.monthly.target.toFixed(2)}</td>
                        <td className="p-2 align-middle text-right"><PercentageCell value={safeRow.monthly.target_achieved} /></td>
                        <td className="p-2 align-middle text-right">{safeRow.cumulative.cur.toFixed(2)}</td>
                        <td className="p-2 align-middle text-right">{safeRow.cumulative.his.toFixed(2)}</td>
                        <td className="p-2 align-middle text-right"><PercentageCell value={safeRow.cumulative.diff_value} /></td>
                        <td className="p-2 align-middle text-right">{safeRow.cumulative.cumulativeTarget.toFixed(2)}</td>
                        <td className="p-2 align-middle text-right"><PercentageCell value={safeRow.cumulative.target_achieved} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {sortedData.length > 0 && (
              <div className="flex-shrink-0">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                  itemsPerPage={itemsPerPage}
                  totalItems={sortedData.length}
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

// --- WRAPPED COMPONENT WITH ERROR BOUNDARY ---
const SalesPerformanceTable: React.FC = () => {
  return (
    <ErrorBoundary>
      <SalesPerformanceTableCore />
    </ErrorBoundary>
  );
};

export default SalesPerformanceTable;
