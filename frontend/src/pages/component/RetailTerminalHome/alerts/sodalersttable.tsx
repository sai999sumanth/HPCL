
import { useState, useCallback, useMemo, useEffect } from 'react';
import { RefreshCw, MoreVertical } from 'lucide-react';
import DataGrid from '@/components/common/DataGrid';
import axios from 'axios';
import { convertUTCDateToLocalDate, formatRelativeTime } from '@/hooks/useRelativeTime';
import { useNavigate } from 'react-router-dom';
import { 
  ModuleRegistry, ColDef, 
  ClientSideRowModelModule
} from 'ag-grid-community';
import React from 'react';
import { Button } from '@/@/components/ui/button';
import { Input } from '@/@/components/ui/input';
import AlertHistoryDialog from '../../alertsTable/AlertHistoryDialog';

// Register AG Grid modules (community only)
ModuleRegistry.registerModules([
  ClientSideRowModelModule
]);

interface ROAlertsTableProps { query?: string; }
interface HistoryDialogState { isOpen: boolean; alertId: string | number | null; }

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
  
export const ROAlertsTable: React.FC<ROAlertsTableProps> = ({ query }) => {
  const [pageSize] = useState(20), [searchText, setSearchText] = useState('');
  const debouncedSearchText = useDebounce(searchText, 300);
  const [selectedColumns, setSelectedColumns] = useState([
    'unique_id','sap_id','region','location_name', 'severity', 'interlock_name', 'created_at', 'device_type', 'device_name', 'actions'
  ]);
  const [historyDialogState, setHistoryDialogState] = useState({ isOpen: false, alertId: null });
  const navigate = useNavigate(), [isLoading, setIsLoading] = useState(false);
  const gridApi = React.useRef<any>(null);
  const gridTheme = {
      '--ag-header-height': '40px',
      '--ag-header-foreground-color': 'white',
      '--ag-header-background-color': 'rgba(7, 82, 140, 0.98)',
      '--ag-header-cell-hover-background-color': 'rgba(0, 58, 89, 0.66)',
      '--ag-header-cell-moving-background-color': 'rgb(40, 100, 140)',
      '--ag-font-size': '14px',
      '--ag-font-family': 'inherit',
      '--ag-row-hover-color': 'rgba(9, 122, 209, 0.1)',
      '--ag-selected-row-background-color': 'rgb(200, 214, 254)',
      '--ag-odd-row-background-color': 'rgb(252, 252, 252)',
      '--ag-header-column-resize-handle-color': 'white',
      '--ag-header-column-resize-handle-width': '4px',
      '--ag-icon-font-color-menu': 'white',
      '--ag-icon-font-color-filter': 'white',
      '--ag-icon-font-color-asc': 'white',
      '--ag-icon-font-color-desc': 'white'
    } as React.CSSProperties;

  const localeText = useMemo(() => ({ 
    applyFilter: 'Apply', cancelFilter: 'Cancel', clearFilter: 'Clear Filter', 
    selectAll: 'Select All', searchOoo: 'Search...', blanks: 'Blanks', noMatches: 'No matches'
  }), []);

  const fetchData = useCallback(async (startRow, endRow, sortModel) => { /* ... */ }, [query, debouncedSearchText]);
  const dataSource = useMemo(() => ({ getRows: async params => { /* ... */ } }), [fetchData]);

  const columnDefs = useMemo(() => [
    { 
      headerName: 'Location ID', field: 'sap_id', sortable: true, 
      cellRenderer: params => <span className="text-blue-600 cursor-pointer" onClick={() => navigate(`/location/${params.value}`)}>{params.value}</span>, 
      hide: !selectedColumns.includes('sap_id')
    },
    /* Other columns with Excel-style filters */
    {
      headerName: 'Actions', field: 'actions', sortable: false, filter: false, width: 100, pinned: 'right',
      cellRenderer: params => (
        <div className="text-right">
          <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => setHistoryDialogState({ isOpen: true, alertId: params.data.id })}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      ),
      hide: !selectedColumns.includes('actions')
    }
  ], [selectedColumns, navigate]);

  const gridOptions = useMemo(() => ({
    localeText, defaultColDef: { flex: 1, minWidth: 100, maxWidth: 300, resizable: true, sortable: true }
  }), [localeText]);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2 space-x-2">
        <div className="flex-grow"><Input placeholder="Search alerts..." value={searchText} onChange={e => setSearchText(e.target.value)} className="w-full h-8" /></div>
        <Button variant="outline" size="sm" onClick={() => gridApi.current?.refreshInfiniteCache()}>
          <RefreshCw className="mr-2 h-4 w-4" />Refresh
        </Button>
      </div>
      <div className="ag-theme-quartz" style={{...gridTheme}}>
        <DataGrid columnDefs={columnDefs} gridOptions={gridOptions} height="610px" pagination pagination-page-size={pageSize} row-selection="single" 
                  on-grid-ready={params => { gridApi.current = params.api; params.api.sizeColumnsToFit(); }} row-model-type="infinite" datasource={dataSource} 
                  cache-block-size={pageSize} infinite-initial-row-count={1} />
      </div>
      <AlertHistoryDialog isOpen={historyDialogState.isOpen} onClose={() => setHistoryDialogState({ isOpen: false, alertId: null })}
      alertId={historyDialogState.alertId} onSubmitSuccess={() => { gridApi.current?.refreshInfiniteCache(); setHistoryDialogState({ isOpen: false, alertId: null }); } } onRequestDocumentUpload={undefined} />
    </div>
  );
};