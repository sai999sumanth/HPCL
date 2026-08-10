import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/@/components/ui/select";
import { Card, CardHeader } from "@/@/components/ui/card";
import { Loader2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from '@/@/components/ui/alert';
import { Button } from '@/@/components/ui/button';
import { Toggle } from '@/@/components/ui/toggle';
import { apiClient } from '@/services/apiClient';

const FISCAL_YEAR_MONTHS = [
  { value: 'APR', label: 'April' },
  { value: 'MAY', label: 'May' },
  { value: 'JUN', label: 'June' },
  { value: 'JUL', label: 'July' },
  { value: 'AUG', label: 'August' },
  { value: 'SEP', label: 'September' },
  { value: 'OCT', label: 'October' },
  { value: 'NOV', label: 'November' },
  { value: 'DEC', label: 'December' },
  { value: 'JAN', label: 'January' },
  { value: 'FEB', label: 'February' },
  { value: 'MAR', label: 'March' },
];

const getCurrentFiscalYearLabel = () => {
  const today = new Date();
  const year = today.getFullYear();
  return today.getMonth() >= 3 ? `FY ${year}-${year + 1}` : `FY ${year - 1}-${year}`;
};

const getCurrentFiscalYearStartYear = () => {
  const today = new Date();
  const year = today.getFullYear();
  return today.getMonth() >= 3 ? year : year - 1;
};

const getAvailableFiscalMonths = () => {
  const today = new Date();
  const previousMonthDate = new Date(today.getFullYear(), today.getMonth(), 0);
  const currentFiscalStartYear = getCurrentFiscalYearStartYear();

  const cutoffIndex =
    previousMonthDate.getFullYear() === currentFiscalStartYear
      ? previousMonthDate.getMonth() - 3
      : previousMonthDate.getMonth() + 9;

  return cutoffIndex >= 0
    ? FISCAL_YEAR_MONTHS.slice(0, cutoffIndex + 1)
    : [FISCAL_YEAR_MONTHS[0]];
};

const AVAILABLE_FISCAL_MONTHS = getAvailableFiscalMonths();
const DEFAULT_SELECTED_MONTH =
  AVAILABLE_FISCAL_MONTHS[AVAILABLE_FISCAL_MONTHS.length - 1]?.value ?? FISCAL_YEAR_MONTHS[0].value;

// Define company order
const companyOrder = ["HPCL", "BPCL", "IOCL", "GAIL", "CPCL", "MRPL", "NRL", "OIL", "ONGC", "RIL", "NEL", "HMEL", "SHELL", "SMA"];

// SBU display names mapping
const sbuDisplayNames = {
  'LPG': 'LPG',
  'MS': 'Motor Spirit (MS)',
  'HSD': 'High Speed Diesel (HSD)',
  'ATF': 'Aviation Turbine Fuel (ATF)',
  'FO': 'Fuel Oil (FO)',
  'LDO': 'Light Diesel Oil (LDO)',
  'SKO': 'Superior Kerosene Oil (SKO)',
  'LSHS': 'Low Sulphur Heavy Stock (LSHS)',
  'BITUMEN': 'Bitumen',
  'LUBES': 'Lubricants'
};

const ErrorBoundary = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleError = (error) => {
      setHasError(true);
      setError(error);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          An error occurred while loading the data. Please try refreshing the page.
          {error && <div className="mt-2 text-xs">{error.message}</div>}
        </AlertDescription>
      </Alert>
    );
  }

  return children;
};

const LoadingOverlay = () => (
  <div className="absolute inset-0 bg-white/80 z-50 flex items-center justify-center">
    <div className="flex flex-col items-center space-y-2">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <span className="text-xs text-gray-600">Loading data...</span>
    </div>
  </div>
);

const calculateTotals = (data) => {
  if (!data || data.length === 0) return null;
  
  // Initialize totals object with company name as TOTAL
  const totals = {
    company: 'TOTAL',
    monthly: {
      volume: { actual: 0, historical: 0 },
      marketShare: { actual: 100, historical: 100, change: 0 } // Market share always totals 100%
    },
    cumulative: {
      volume: { actual: 0, historical: 0 },
      marketShare: { actual: 100, historical: 100, change: 0 } // Market share always totals 100%
    }
  };
  
  // Sum all volume values
  data.forEach(item => {
    if (item.monthly && item.monthly.volume) {
      totals.monthly.volume.actual += (item.monthly.volume.actual || 0);
      totals.monthly.volume.historical += (item.monthly.volume.historical || 0);
    }
    
    if (item.cumulative && item.cumulative.volume) {
      totals.cumulative.volume.actual += (item.cumulative.volume.actual || 0);
      totals.cumulative.volume.historical += (item.cumulative.volume.historical || 0);
    }
    if (item.monthly && item.monthly.marketShare) {
      totals.monthly.marketShare.change += (item.monthly.marketShare.change || 0);
      totals.cumulative.marketShare.change += (item.cumulative.marketShare.change || 0);
    }
  });
  
  return totals;
};

const SbuWiseIndustryPerformanceGrid = ({ sbu }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(DEFAULT_SELECTED_MONTH);
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rowData, setRowData] = useState([]);
  const [columnDefs, setColumnDefs] = useState([]);
  const gridApiRef = useRef(null);
  const gridContainerRef = useRef(null);
  const [isCToggled, setIsCToggled] = useState(false);
  const [availableMonths] = useState(() => [...AVAILABLE_FISCAL_MONTHS]);

  const createColumnDefs = (monthCode) => {
    const monthLabel = FISCAL_YEAR_MONTHS.find((m) => m.value === monthCode)?.label || 'Month';
      
    return [
      { 
        headerName: 'Company', 
        field: 'company', 
        headerClass: 'text-xs font-medium',
        width: 180,
        minWidth: 180,
        maxWidth: 190,
        cellClass: params => {
          return params.data.company === 'TOTAL' ? 'total-row' : 'text-xs';
        },
        comparator: (valueA, valueB) => {
          // Always keep TOTAL at the top
          if (valueA === 'TOTAL') return -1;
          if (valueB === 'TOTAL') return 1;
          
          const indexA = companyOrder.indexOf(valueA);
          const indexB = companyOrder.indexOf(valueB);
          
          // If both companies are in the order list
          if (indexA >= 0 && indexB >= 0) {
            return indexA - indexB;
          }
          
          // If only valueA is in the order list
          if (indexA >= 0) {
            return -1;
          }
          
          // If only valueB is in the order list
          if (indexB >= 0) {
            return 1;
          }
          
          // If neither is in the order list, sort alphabetically
          return valueA.localeCompare(valueB);
        },
        sort: 'asc', // Apply sorting by default
        sortable: true,
      },
      {
        headerName: monthLabel,
        children: [
          {
            headerName: 'Sales (TMT)',
            children: [
              { 
                headerName: 'CY', 
                field: 'monthly.volume.actual', 
                valueFormatter: params => params.value?.toLocaleString(),
                headerClass: 'text-xs font-medium',
                cellClass: params => {
                  return params.data.company === 'TOTAL' ? 'total-row' : 'text-xs';
                },
                width: 175,
                minWidth: 135,
                maxWidth: 195
              },
            ]
          },
          {
            headerName: 'Market Share (%)',
            children: [
              { 
                headerName: 'CY', 
                field: 'monthly.marketShare.actual', 
                valueFormatter: params => params.value?.toFixed(2),
                headerClass: 'text-xs font-medium',
                cellClass: params => {
                  return params.data.company === 'TOTAL' ? 'total-row' : 'text-xs';
                },
                width: 175,
                minWidth: 135,
                maxWidth: 195
              },
              { 
                headerName: 'G/L', 
                field: 'monthly.marketShare.change', 
                valueFormatter: params => params.value?.toFixed(2),
                headerClass: 'text-xs font-medium',
                cellClass: params => {
                  const classes = params.data.company === 'TOTAL' ? 'total-row' : 'text-xs';
                  return params.value > 0 ? `${classes} text-green-500` : `${classes} text-red-500`;
                },
                width: 175,
                minWidth: 135,
                maxWidth: 195
              }
            ]
          }
        ]
      },
      {
        headerName: `Cumulative ${isCToggled ? "(APR to MAR)" : `(APR to ${monthCode})`}`,
        children: [
          {
            headerName: 'Sales (TMT)',
            children: [
              { 
                headerName: 'CY', 
                field: 'cumulative.volume.actual', 
                valueFormatter: params => params.value?.toLocaleString(),
                headerClass: 'text-xs font-medium',
                cellClass: params => {
                  return params.data.company === 'TOTAL' ? 'total-row' : 'text-xs';
                },
                width: 175,
                minWidth: 135,
                maxWidth: 195
              },
            ]
          },
          {
            headerName: 'Market Share (%)',
            children: [
              { 
                headerName: 'CY', 
                field: 'cumulative.marketShare.actual', 
                valueFormatter: params => params.value?.toFixed(2),
                headerClass: 'text-xs font-medium',
                cellClass: params => {
                  return params.data.company === 'TOTAL' ? 'total-row' : 'text-xs';
                },
                width: 175,
                minWidth: 135,
                maxWidth: 195
              },
              { 
                headerName: 'G/L', 
                field: 'cumulative.marketShare.change', 
                valueFormatter: params => params.value?.toFixed(2),
                headerClass: 'text-xs font-medium',
                cellClass: params => {
                  const classes = params.data.company === 'TOTAL' ? 'total-row' : 'text-xs';
                  return params.value > 0 ? `${classes} text-green-500` : `${classes} text-red-500`;
                },
                width: 175,
                minWidth: 135,
                maxWidth: 195
              }
            ]
          }
        ]
      }
    ];
  };

  // Update column definitions when selected month changes
  useEffect(() => {
    setColumnDefs(createColumnDefs(selectedMonth));
  }, [selectedMonth, isCToggled]);

const fetchData = useCallback(async (month, sbuValue, isCToggled?) => {
    if (!sbuValue || !month) return;
    
    setIsLoading(true);
    setError(null);
    try {
      // Create a base filters array with common filters including SBU filter
      const baseFilters = [
        { key: '"A"', cond: 'equals', value: 'true' },
        { key: '"H"', cond: 'equals', value: 'true' },
        { key: '"YTM"', cond: 'equals', value: 'true' },
        { key: '"table"', cond: 'equals', value: 'true' },
        { key: '"table_month"', cond: 'equals', value: month },
        { key: '"cumulative"', cond: 'equals', value: 'True' },
        { key: '"sbu_name"', cond: 'equals', value: sbuValue.toUpperCase() } // Convert to uppercase
      ];

      // Conditionally add the "C" filter if the toggle is on
      const filters = isCToggled 
        ? [...baseFilters, { key: '"cumulative"', cond: 'equals', value: 'True' }]
        : baseFilters;

      const requestBody = {
        filters,
        cross_filters: [],
        action: 'industry_performance',
        drill_state: '',
        time_grain: 'Monthly',
        resp_format: 'company_level'
      };

      const response = await apiClient.post('/api/charts/generate_vis_data', requestBody);

      if (!response.status) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const payload = response.data;
      const rows = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : null;
      if (rows === null) {
        throw new Error('No data received from the server');
      }

      // Sort the data according to companyOrder
      const sortedData = [...rows].sort((a, b) => {
        const indexA = companyOrder.indexOf(a.company);
        const indexB = companyOrder.indexOf(b.company);

        // If both companies are in the order list
        if (indexA >= 0 && indexB >= 0) {
          return indexA - indexB;
        }

        // If only a is in the order list
        if (indexA >= 0) {
          return -1;
        }

        // If only b is in the order list
        if (indexB >= 0) {
          return 1;
        }

        // If neither is in the order list, sort alphabetically
        return a.company.localeCompare(b.company);
      });

      // Calculate totals row
      const totalsRow = calculateTotals(sortedData);

      // Add totals row at the beginning of the data array
      const dataWithTotals = totalsRow ? [totalsRow, ...sortedData] : sortedData;
      setRowData(dataWithTotals);
    } catch (error) {
      console.error('Error fetching data:', error);
      const msg = error instanceof Error ? error.message : 'Failed to load data';
      setError(`Error fetching data for ${sbuDisplayNames[sbuValue] || sbuValue}: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedMonth && sbu) {
      fetchData(selectedMonth, sbu, isCToggled);
    }
  }, [selectedMonth, sbu, isCToggled, fetchData, dataRefreshKey]);

  const handleToggle = (isToggled) => {
    setIsCToggled(isToggled);
    if (sbu && selectedMonth) {
      fetchData(selectedMonth, sbu, isToggled);
    }
  };

  const handleMonthChange = (month) => {
    setSelectedMonth(month);
  };

  const handleRefresh = () => {
    if (!sbu) return;
    setIsCToggled(false);
    setSelectedMonth(DEFAULT_SELECTED_MONTH);
    setDataRefreshKey((k) => k + 1);
  };

  const onGridReady = (params) => {
    gridApiRef.current = params.api;
    
    // Size columns to fit once the grid is ready
    if (params.api) {
      params.api.sizeColumnsToFit();
    }
  };

  // Show loading if no SBU is provided
  if (!sbu) {
    return (
      <Card className="overflow-hidden relative">
        <CardHeader className="text-sm font-bold p-1">
          Industry Performance - No SBU Selected
        </CardHeader>
        <div className="p-4 text-center text-gray-500">
          Please select an SBU to view industry performance data.
        </div>
      </Card>
    );
  }

  return (
    <ErrorBoundary>
      <Card className="overflow-hidden relative">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b p-2 py-1.5">
          <span className="text-sm font-bold leading-tight min-w-0 flex-1">
            Industry Performance for {sbuDisplayNames[sbu] || sbu} - Marketing ({getCurrentFiscalYearLabel()})
          </span>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="text-xs font-medium whitespace-nowrap">Select Month:</span>
            <Select value={selectedMonth} onValueChange={handleMonthChange}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map((month) => (
                  <SelectItem key={month.value} value={month.value} className="text-xs">
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="default"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full !bg-blue-600 !text-white hover:!bg-blue-700 focus-visible:ring-blue-500"
              onClick={handleRefresh}
              disabled={isLoading || !sbu}
              aria-label="Refresh data"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <div className="flex items-center gap-1.5 border-l border-border pl-3 ml-1">
              <span className="text-xs font-medium whitespace-nowrap">SBU:</span>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                {sbuDisplayNames[sbu] || sbu}
              </span>
            </div>
          </div>
        </CardHeader>

        {error && (
          <Alert variant="destructive" className="m-2">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div ref={gridContainerRef} className="ag-theme-alpine" style={{ height: "500px", width: "100%" }}>
          <style>
            {`
              .ag-theme-alpine {
                --ag-font-size: 12px;
              }
              .total-row {
                font-weight: bold;
                font-size: 14px;
                background-color: #E6F7FF;
              }
              .ag-header-cell-text {
                font-size: 12px;
                font-weight: 600;
              }
          
              .ag-header-cell {
                background-color: #f9fafb !important;
              }
              .ag-header-group-cell {
                background-color: #f3f4f6 !important;
                font-weight: 600;
              }
            `}
          </style>
          
          {isLoading && <LoadingOverlay />}
          
          <AgGridReact
            columnDefs={columnDefs}
            rowData={rowData}
            defaultColDef={{
              sortable: true,
              filter: true,
              resizable: true,
              flex: 1,
            }}
            pagination={true}
            enableCellTextSelection={true}
            suppressCellFocus={true}
            domLayout="normal"
            headerHeight={30}
            rowHeight={30}
            suppressMovableColumns={false}
            suppressContextMenu={true}
            suppressMenuHide={true}
            suppressRowClickSelection={true}
            onGridReady={onGridReady}
          />
        </div>
      </Card>
    </ErrorBoundary>
  );
};

export default SbuWiseIndustryPerformanceGrid;