import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Input } from '@/@/components/ui/input';
import { Badge } from '@/@/components/ui/badge';
import { TrendingUp, TrendingDown, RefreshCw, AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import DataGrid from '@/components/common/DataGrid';
import { plantPerformanceData } from './plantPerformanceData';

const PlantPerformanceTable: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const gridApi = useRef<any>(null);

  // Use data from separate file
  const plantData = plantPerformanceData;

  const getEfficiencyColor = (efficiency: string) => {
    const value = parseFloat(efficiency);
    if (value >= 90) return '#10b981';
    if (value >= 50) return '#f59e0b';
    return '#ef4444';
  };

  // Calculate status counts from filtered data
  const [statusCounts, setStatusCounts] = useState({ critical: 0, warning: 0, normal: 0 });

  const updateStatusCounts = useCallback(() => {
    if (!gridApi.current) {
      // Calculate from all data if grid not ready
      const counts = {
        critical: plantData.filter((p: any) => p.status.toLowerCase() === 'critical').length,
        warning: plantData.filter((p: any) => p.status.toLowerCase() === 'warning').length,
        normal: plantData.filter((p: any) => p.status.toLowerCase() === 'normal').length,
      };
      setStatusCounts(counts);
      return;
    }
    
    let allRows: any[] = [];
    gridApi.current.forEachNodeAfterFilter((node: any) => {
      if (node.data) {
        allRows.push(node.data);
      }
    });
    
    // If no rows visible (filtered out), use original data
    if (allRows.length === 0) {
      allRows = plantData;
    }
    
    const counts = {
      critical: allRows.filter((p: any) => p.status.toLowerCase() === 'critical').length,
      warning: allRows.filter((p: any) => p.status.toLowerCase() === 'warning').length,
      normal: allRows.filter((p: any) => p.status.toLowerCase() === 'normal').length,
    };
    setStatusCounts(counts);
  }, [plantData]);

  const onGridReady = useCallback((params: any) => {
    gridApi.current = params.api;
    params.api.sizeColumnsToFit();
    updateStatusCounts();
    
    // Update counts when filter changes
    params.api.addEventListener('filterChanged', updateStatusCounts);
  }, [updateStatusCounts]);

  const columnDefs = useMemo(() => [
    {
      headerName: 'PLANT NAME',
      field: 'plantName',
      sortable: true,
      filter: true,
      minWidth: 180,
      cellStyle: { color: '#3b82f6', fontWeight: 500 },
    },
    {
      headerName: 'SBU',
      field: 'sbu',
      sortable: true,
      filter: true,
      minWidth: 100,
    },
    {
      headerName: 'ZONE',
      field: 'zone',
      sortable: true,
      filter: true,
      minWidth: 120,
    },
    {
      headerName: 'CAPACITY',
      field: 'capacity',
      sortable: true,
      filter: true,
      minWidth: 120,
      comparator: (valueA: string, valueB: string) => {
        const numA = parseFloat(valueA.replace(/[^\d.]/g, ''));
        const numB = parseFloat(valueB.replace(/[^\d.]/g, ''));
        return numA - numB;
      },
    },
    {
      headerName: 'GENERATION (TODAY)',
      field: 'generationToday',
      sortable: true,
      filter: true,
      minWidth: 180,
      comparator: (valueA: string, valueB: string) => {
        const numA = parseFloat(valueA.replace(/[^\d.]/g, ''));
        const numB = parseFloat(valueB.replace(/[^\d.]/g, ''));
        return numA - numB;
      },
    },
    {
      headerName: 'EFFICIENCY',
      field: 'efficiency',
      sortable: true,
      filter: true,
      minWidth: 140,
      comparator: (valueA: string, valueB: string) => {
        return parseFloat(valueA) - parseFloat(valueB);
      },
      cellRenderer: (params: any) => {
        const efficiency = params.value;
        const efficiencyValue = parseFloat(efficiency);
        const color = getEfficiencyColor(efficiency);
        
        return (
          <div className="flex items-center gap-1 h-full">
            <span style={{ color, fontWeight: 600 }}>
              {efficiency}
            </span>
            {efficiencyValue > 50 ? (
              <TrendingUp className="h-3 w-3 text-green-600" />
            ) : efficiencyValue < 50 ? (
              <TrendingDown className="h-3 w-3 text-red-600" />
            ) : null}
          </div>
        );
      },
    },
    {
      headerName: 'GRID STATUS',
      field: 'gridStatus',
      sortable: true,
      filter: true,
      minWidth: 140,
      cellRenderer: (params: any) => {
        const status = params.value;
        const isOnline = status === 'Online';
        return (
          <Badge 
            className={`${
              isOnline 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
            } border-0 px-2 py-0.5 rounded-full text-xs font-medium`}
          >
            {status}
          </Badge>
        );
      },
    },
    {
      headerName: 'STATUS',
      field: 'status',
      sortable: true,
      filter: true,
      minWidth: 140,
      cellRenderer: (params: any) => {
        const status = params.value.toLowerCase();
        const colorClass = 
          status === 'critical'
            ? 'bg-red-100 text-red-700'
            : status === 'warning'
            ? 'bg-orange-100 text-orange-700'
            : 'bg-green-100 text-green-700';
        
        return (
          <Badge 
            className={`${colorClass} border-0 px-2 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
            {params.value}
          </Badge>
        );
      },
    },
  ], []);

  // Update counts when search text changes
  useEffect(() => {
    // Small delay to let ag-grid process the filter
    const timer = setTimeout(() => {
      updateStatusCounts();
    }, 100);
    return () => clearTimeout(timer);
  }, [searchText, updateStatusCounts]);

  const autoSizeStrategy = useMemo(() => {
    return {
      type: 'fitCellContents' as const
    };
  }, []);

  const handleRefresh = () => {
    if (gridApi.current) {
      gridApi.current.refreshCells();
      updateStatusCounts();
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-3">Plant Performance Details</h3>
      <div className="flex flex-col sm:flex-row gap-3 mb-3 items-center">
        <div className="relative flex-1 flex items-center gap-2">
          <Input
            type="text"
            placeholder="Search plant..."
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              if (gridApi.current) {
                gridApi.current.setQuickFilter(e.target.value);
              }
            }}
            className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 shadow-sm focus:shadow-md transition-shadow"
          />
          <button
            onClick={handleRefresh}
            className="flex items-center justify-center p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
            title="Refresh table"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>
      
      <div className="border border-gray-200 overflow-hidden bg-white relative shadow-sm">
        <div className="[&_.ag-header-cell]:!bg-blue-100 [&_.ag-header-cell-text]:!text-gray-700 [&_.ag-header-cell-text]:!font-semibold [&_.ag-paging-panel]:!flex [&_.ag-paging-panel]:!items-center [&_.ag-paging-panel]:!justify-end [&_.ag-paging-panel]:!pr-4 [&_.ag-paging-panel]:!ml-[400px]">
          <DataGrid
            rowData={plantData}
            columnDefs={columnDefs}
            height="500px"
            pagination={true}
            paginationPageSize={10}
            rowSelection="single"
            onGridReady={onGridReady}
            rowModelType="clientSide"
            defaultColDef={{
              flex: 1,
              resizable: true,
              sortable: true,
              filter: false,
              suppressMenu: true,
              autoSizeStrategy,
            }}
            quickFilterText={searchText}
          />
        </div>
        
        {/* Status Summary - Positioned beside pagination controls */}
        <div className="absolute bottom-0 left-4 flex items-center gap-4 py-2 z-10 whitespace-nowrap" style={{ height: '48px' }}>
          <span className="text-sm text-gray-700 font-semibold whitespace-nowrap">Status Summary:</span>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <Badge className="bg-red-100 text-red-700 border-0 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap shadow-sm">
              Critical: 4
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0" />
            <Badge className="bg-orange-100 text-orange-700 border-0 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap shadow-sm">
              Warning: 6
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
            <Badge className="bg-green-100 text-green-700 border-0 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap shadow-sm">
              Normal: 10
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlantPerformanceTable;
