
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { GridOptions, GridReadyEvent, GridApi, SizeColumnsToFitGridStrategy, SizeColumnsToFitProvidedWidthStrategy, SizeColumnsToContentStrategy } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

interface DataGridProps {
  rowData?: any[];
  columnDefs: any[];
  defaultColDef?: any;
  gridOptions?: GridOptions;
  style?: React.CSSProperties
  onGridReady?: (params: GridReadyEvent) => void;
  onSelectionChanged?: (selectedRows: any[]) => void;
  onFilterChanged?: (filterModel: any) => void;
  onPaginationChanged?: (params: any) => void;
  loading?: boolean;
  height?: string;
  width?: string;
  rowSelection?: 'single' | 'multiple';
  className?: string;
  suppressRowClickSelection?: boolean;
  pagination?: boolean;
  paginationPageSize?: number;
  paginationPageSizeSelector?: number[] | boolean;
  enableRangeSelection?: boolean;
  animateRows?: boolean;
  headerHeight?: number;
  quickFilterText?: string;
  suppressCellFocus?: boolean;
  rowModelType?: 'infinite' | 'clientSide';
  datasource?: {
    getRows: (params: any) => void;
  };
  cacheBlockSize?: number;
  infiniteInitialRowCount?: number;
  /** When true, skips `sizeColumnsToFit` on ready and window resize (use with `gridOptions.autoSizeStrategy`, e.g. `fitGridWidth`). */
  suppressSizeColumnsToFit?: boolean;
  /** When true, uses each column's `cellStyle.textAlign` instead of forcing left alignment. */
  respectColumnTextAlign?: boolean;
  /** When true, hides the "no rows" overlay while `loading` is true. */
  suppressNoRowsOverlayWhenLoading?: boolean;
}

const DataGrid: React.FC<DataGridProps> = ({  
  rowData,
  columnDefs,
  defaultColDef = {
    sortable: true,
    filter: false,
    resizable: true,
    editable: true,
    flex: 1,
    // tooltipField, tooltipComponent, tooltipComponentParams, tooltipValueGetter removed
    cellStyle: {
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      userSelect: 'text',
      cursor: 'text',
      verticalAlign: 'left',
      fontSize: '12px',
      padding: '4px',
      fontFamily: 'Arial, sans-serif'
    },
    enableCellTextSelection: true,
    suppressMovable: true
  },
  gridOptions = {
    enableCellTextSelection: true,
    suppressCopyRowsToClipboard: false,
    ensureDomOrder: true,
    suppressMenu: true
  },
  onGridReady,
  onSelectionChanged,
  onFilterChanged,
  onPaginationChanged,
  loading = false,
  height = '500px',
  width = '100%', // FIXED: Changed default to always be 100%
  rowSelection = 'multiple',
  className = '',
  style,
  suppressRowClickSelection = true,
  pagination = true,
  paginationPageSize = 10,
  paginationPageSizeSelector,
  enableRangeSelection = true,
  animateRows = true,
  headerHeight = 40,
  quickFilterText = '',
  suppressCellFocus = true,
  rowModelType = 'clientSide',
  datasource,
  cacheBlockSize,
  infiniteInitialRowCount,
  suppressSizeColumnsToFit = false,
  respectColumnTextAlign = false,
  suppressNoRowsOverlayWhenLoading = false,
}) => {
  const gridRef = useRef<AgGridReact>(null);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [gridColumnApi, setGridColumnApi] = useState<any | null>(null);

  const processedColumnDefs = columnDefs.map(colDef => ({
    ...colDef,
    // Only honor tooltip props that a column explicitly sets (e.g. remarks).
    // No fallback to colDef.field, no ellipsis-overflow auto-tooltip.
    tooltipField: colDef.tooltipField,
    tooltipValueGetter: colDef.tooltipValueGetter,
    enableCellTextSelection: true,
    cellStyle: {
      userSelect: 'text',
      filter: false,
      cursor: 'text',
      fontSize: '12px',
      padding: '4px',
      fontFamily: 'Arial, sans-serif',
      textAlign: respectColumnTextAlign ? (colDef?.cellStyle?.textAlign ?? 'left') : 'left',
      ...(colDef.cellStyle || {}),
    },
    floatingFilter: false,
  }));

  useEffect(() => {
    if (gridApi) {
      gridApi.setQuickFilter(quickFilterText || '');
    }
  }, [quickFilterText, gridApi]); 

  const autoSizeStrategy = useMemo<
    | SizeColumnsToFitGridStrategy
    | SizeColumnsToFitProvidedWidthStrategy
    | SizeColumnsToContentStrategy
  >(() => {
    return {
      type: "fitCellContents",
    };
  }, []);

  const handleGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
    setGridColumnApi(params.api);

    if (onGridReady) {
      onGridReady(params);
    }

    if (!suppressSizeColumnsToFit) {
      params.api.sizeColumnsToFit();
    }

    if (quickFilterText) {
      params.api.setQuickFilter(quickFilterText);
    }
  }, [onGridReady, quickFilterText, suppressSizeColumnsToFit]);

  const handleSelectionChanged = useCallback(() => {
    if (onSelectionChanged && gridApi) {
      const selectedRows = gridApi.getSelectedRows();
      onSelectionChanged(selectedRows);
    }
  }, [gridApi, onSelectionChanged]);

  const handleFilterChanged = useCallback(() => { 
    if (onFilterChanged && gridApi) {
      const filterModel = gridApi.getFilterModel();
      onFilterChanged(filterModel);
    }
  }, [gridApi, onFilterChanged]);

  const handlePaginationChanged = useCallback((params: any) => { 
    if (onPaginationChanged) {
      onPaginationChanged(params);
    }
  }, [onPaginationChanged]);

  useEffect(() => {
    if (suppressSizeColumnsToFit) {
      return;
    }
    const handleResize = () => {
      if (gridApi) {
        gridApi.sizeColumnsToFit();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [gridApi, suppressSizeColumnsToFit]);

  return (
    <div 
      className={`ag-theme-alpine ${className}`} 
      style={{...style, height, width, position: 'relative' }}
    >
      {loading && (
        <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-50">
          <div
            className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500 border-blue-500/30"
            aria-hidden
          />
        </div>
      )}
      <AgGridReact
        ref={gridRef}
        rowData={rowData}
        columnDefs={processedColumnDefs}
        defaultColDef={defaultColDef}
        onGridReady={handleGridReady}
        onSelectionChanged={handleSelectionChanged}
        onFilterChanged={handleFilterChanged}
        onPaginationChanged={handlePaginationChanged}
        rowSelection={rowSelection}
        suppressRowClickSelection={suppressRowClickSelection}
        pagination={pagination}
        paginationPageSize={paginationPageSize}
        paginationPageSizeSelector={paginationPageSizeSelector}
        enableRangeSelection={enableRangeSelection}
        animateRows={animateRows}
        headerHeight={headerHeight}
        tooltipShowDelay={0}
        enableCellTextSelection={true}
        ensureDomOrder={true}
        rowModelType={rowModelType}
        datasource={datasource}
        cacheBlockSize={cacheBlockSize}
        infiniteInitialRowCount={infiniteInitialRowCount}
        autoSizeStrategy={autoSizeStrategy}
        suppressNoRowsOverlay={suppressNoRowsOverlayWhenLoading && loading}
        {...gridOptions}
      />
    </div>
  );
};

export default DataGrid;

