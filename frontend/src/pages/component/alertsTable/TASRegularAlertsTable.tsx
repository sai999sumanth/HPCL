import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Button } from '../../../@/components/ui/button';
import { Input } from '../../../@/components/ui/input';
import { 
  RefreshCw, 
  Triangle
} from 'lucide-react';
import DataGrid from '../../../components/common/DataGrid';
import { Badge } from "../../../@/components/ui/badge";
import axios from 'axios';
import { convertUTCDateToLocalDate, formatRelativeTime } from '@/hooks/useRelativeTime';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/services/apiClient';


interface ROAlertsTableV2Props {
  query?: string;
  onLocationChange?: (locationId: string) => void;
}

interface HistoryDialogState {
  isOpen: boolean;
  alertId: string | number | null;
}

const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export const RegularAlertTable: React.FC<ROAlertsTableV2Props> = ({ query,onLocationChange }) => { 
  const [pageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [searchText, setSearchText] = useState<string>('');
  const debouncedSearchText = useDebounce(searchText, 300);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([ 
    'unique_id', 'sap_id', 'region', 'location_name', 'severity', 'interlock_name', 
    'created_at', 'device_type', 'device_name', 'assigned_user_roles', 'last_escalated_to',
    'last_notified_to', 'actions'
  ]);
  const [historyDialogState, setHistoryDialogState] = useState<HistoryDialogState>({
    isOpen: false,
    alertId: null
  });
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const gridApi = React.useRef<any>(null);

  const handleViewHistory = useCallback((alertId: string | number) => {
    setHistoryDialogState({
      isOpen: true,
      alertId
    });
  }, []);

  const fetchData = useCallback(async (startRow: number, endRow: number, sortModel?: any) => {
    setIsLoading(true);
    try {
      // Calculate the current page based on startRow and pageSize
      const currentPageNumber = Math.floor(startRow / pageSize);
      
      const params: any = {
        q: query,
        skip: currentPageNumber, // Using sequential page numbers (0, 1, 2, 3...)
        limit: pageSize,
        sort: sortModel?.length 
        ? JSON.stringify({ [sortModel[0].colId]: sortModel[0].sort })
        : JSON.stringify({"created_at": "desc"})      };
      
      if (debouncedSearchText.trim()) {
        params.search_text = debouncedSearchText;
      }
  
      const response = await apiClient.get('/api/alerts', { params });
      console.log("response ag grid",response);
      
      setCurrentPage(currentPageNumber);
      
      return {
        data: response.data.data,
        lastRow: response.data.total
      };
    } catch (err) {
      console.error('Error fetching alerts:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [query, debouncedSearchText, pageSize]);

  const dataSource = useMemo(() => ({
    getRows: async (params: any) => {
      try {
        const result = await fetchData(params.startRow, params.endRow, params.sortModel);
        params.successCallback(result.data, result.lastRow);
      } catch (err) {
        params.failCallback();
      }
    }
  }), [fetchData]);

  useEffect(() => {
    if (gridApi.current) {
      gridApi.current.refreshInfiniteCache();
      setCurrentPage(0); // Reset to first page when search changes
    }
  }, [debouncedSearchText]);

  const onGridReady = useCallback((params: any) => {
    gridApi.current = params.api;
    params.api.sizeColumnsToFit();
  }, []);

  const handleRefresh = useCallback(() => {
    setSearchText('');   
    // setSelectedSapId(null);
    // setSelectedZone(null);
    
    if (onLocationChange) {
      onLocationChange('');
    }
    
    if (gridApi.current) {
      gridApi.current.refreshInfiniteCache();
      setCurrentPage(0); // Reset to first page on refresh
    }
  }, []);

  const handleLocationView = (sapId: string) => {
    navigate(`/location/${sapId}`);
  };
  const handleLocationClick = useCallback((sapId: string) => {
    if (onLocationChange) {
      onLocationChange(sapId);
    } else {
      navigate(`/location/${sapId}`);
    }
  }, [onLocationChange, navigate]);
  // Cell Renderer Components
  const SeverityIndicator = useCallback(({ severity }) => {
    const colorMap = {
      'Critical': 'text-red-600',
      'High': 'text-orange-600',
      'Medium': 'text-yellow-600',
      'Low': 'text-green-600'
    };
  
    return (
      <div className={`flex items-center mt-3 space-x-1 ${colorMap[severity] || 'text-gray-600'} text-xs`}>
        <Triangle className="h-3 w-3" />
        <span>{severity}</span>
      </div>
    );
  }, []);

  // Column Definitions
  const columnDefs = useMemo(() => [
    { 
        headerName: 'Alert Active Time', 
        field: 'created_at',
        sortable: true,
        filter: true,
        cellRenderer: (params: any) => {
          if (!params.value) return '';
          try {
            // Convert UTC to local time
            const utcDate = new Date(params.value);
            const localDate = convertUTCDateToLocalDate(utcDate);
            
            // Format the absolute time using the converted local date
            const formattedDateTime = localDate.toLocaleString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            });
            
            // Get the relative time (already handles UTC conversion internally)
            const relativeTime = formatRelativeTime(params.value);
            
            // Return both times in a stacked layout
            return ( 
              <div className="flex flex-col">
                <span className="text-sm text-gray-900">{relativeTime}</span>
                <span className="text-xs text-gray-500">{formattedDateTime}</span>
              </div>
            );
          } catch (error) {
            console.error('Error formatting date:', error);
            return 'Invalid date';
          }
        },
        hide: !selectedColumns.includes('created_at'),
        minWidth: 150, // Ensure enough width for both lines
      },

    { 
      headerName: 'Location ID', 
      field: 'sap_id',
      sortable: true,
      minWidth: 100,
      filter: true,
      cellRenderer: (params: any) => ( 
        <span className="text-blue-600 hover:text-blue-800 cursor-pointer"
              onClick={() => handleLocationClick(params.value)}>
          {params.value}
        </span>
      ),
      hide: !selectedColumns.includes('sap_id')
    },
    { 
      headerName: 'Location', 
      field: 'location_name',
      sortable: true,
      filter: true,
      cellRenderer: (params: any) => (
        <span className="text-blue-600 hover:text-blue-800 cursor-pointer"
              onClick={() => handleLocationClick(params.data.sap_id)}>
          {params.value}
        </span>
      ),
      hide: !selectedColumns.includes('location_name')
    },
    { 
      headerName: 'Zone',
      field: 'zone',
      sortable: true,
      filter: true,
      hide: !selectedColumns.includes('zone')
    },
    { 
      headerName: 'System',
      field: 'device_type',
      sortable: true,
      filter: true,
      hide: false,
    },
    { 
      headerName: 'Alarm Name', 
      field: 'interlock_name',
      minWidth:155,
      sortable: true,
      filter: true,
      hide: !selectedColumns.includes('interlock_name')
    },
    { 
        headerName: 'Equipement ID',
        field: 'device_name',
        minWidth:180,
        sortable: true,
        filter: true,
        valueFormatter: (params) => params.value?.split('@')[0] || '',
        hide: !selectedColumns.includes('device_name')
      },
    { 
      headerName: 'Alert Closed Time',
      field: 'updated_at',
      sortable: true,
      filter: true,
      cellRenderer: (params: any) => {
        if (!params.value) return '';
        try {
          // Convert UTC to local time
          const utcDate = new Date(params.value);
          const localDate = convertUTCDateToLocalDate(utcDate);
    
          // Format the absolute time using the converted local date
          const formattedDateTime = localDate.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });
    
          // Get the relative time
          const relativeTime = formatRelativeTime(params.value);
    
          // Return both times in a stacked layout
          return (
            <div className="flex flex-col">
              <span className="text-sm text-gray-900">{relativeTime}</span>
              <span className="text-xs text-gray-500">{formattedDateTime}</span>
            </div>
          );
        } catch (error) {
          console.error('Error formatting date:', error);
          return 'Invalid date';
        }
      },
    },
      
  ], [selectedColumns, handleViewHistory]);

  return (
    <div className="w-full mb-8">
      {/* Existing JSX remains the same */}
      <div className="flex justify-between items-center mb-2 space-x-2">
        <div className="flex-grow">
          <Input 
            placeholder="Search alerts..." 
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full h-8"
          />
        </div>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="[&_.ag-header-cell]:!bg-gray-100 [&_.ag-header-cell-text]:!text-gray-700">
        <DataGrid
          columnDefs={columnDefs}
          height="610px"
          pagination={true}
          paginationPageSize={pageSize}
          rowSelection="single"
          onGridReady={onGridReady}
          rowModelType="infinite"
          datasource={dataSource}
          cacheBlockSize={pageSize}
          infiniteInitialRowCount={1}
          defaultColDef={{
            flex: 1,
            minWidth: 100,
            maxWidth: 300,
            resizable: true,
            sortable: true,
            filter: true
          }}
        />
      </div>
    </div>
  );
};

export default RegularAlertTable;
