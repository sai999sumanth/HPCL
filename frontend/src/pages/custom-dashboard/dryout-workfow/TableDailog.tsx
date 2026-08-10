import React, { useEffect, useMemo, useRef, useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/@/components/ui/dialog";
import { Card, CardContent } from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { RiFileExcel2Fill } from "react-icons/ri";
import dayjs from "dayjs";
import { toast } from "sonner";
import { 
  ClientSideRowModelModule, 
  ColDef, 
  ModuleRegistry, 
  CsvExportModule, 
  SizeColumnsToContentStrategy, 
  SizeColumnsToFitGridStrategy, 
  SizeColumnsToFitProvidedWidthStrategy,
  GridApi,
  ValueFormatterParams 
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
// Removed enterprise modules - using community only
import { formatDateToIST } from '@/hooks/useRelativeTime';

// Register AG Grid modules (community only)
ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  CsvExportModule
]);

// Import AG Grid styles
import "ag-grid-community/styles/ag-theme-quartz.css";
import "ag-grid-community/styles/ag-grid.css";

const TableDialog = ({ isOpen, onClose, data, title }) => {
  const [columnDefs, setColumnDefs] = useState([]);
  const gridRef = useRef<AgGridReact<any>>(null);
  const currentDateTime = dayjs().format('DDMMYYYYHH:mm:ss');
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  // Theme configuration
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
  };

  const defaultColDef = {
    flex: 1,
    resizable: true,
    floatingFilter: false,
    suppressSizeToFit: true,
    sortable: true,
    filter: "agSetColumnFilter"
  };

  const autoSizeStrategy = useMemo<
    | SizeColumnsToFitGridStrategy
    | SizeColumnsToFitProvidedWidthStrategy
    | SizeColumnsToContentStrategy
  >(() => {
    return {
      type: "fitCellContents",
      defaultMinWidth: 100
    };
  }, []);

  useEffect(() => {
    if (data && data.length > 0) {
      // Generate column definitions from the first data item
      const columns = Object.keys(data[0]).map(key => {
        // Default column definition
        let columnDef: ColDef = {
          field: key,
          headerName: key.replace(/_/g, ' ').toUpperCase(),
          sortable: true,
          filter: "agSetColumnFilter",
          suppressSizeToFit: true
        };
        
        // Check if the field name specifically contains date-related terms
        // Only apply date formatting to columns that are likely to contain dates
        if (key.toLowerCase().includes('date') || key.toLowerCase().includes('_dt')) {
          columnDef.valueFormatter = (params) => {
            if (params.value && 
                typeof params.value === 'string' && 
                params.value.includes('T')) {
              return formatDateToIST(params.value);
            }
            return params.value;
          };
        }
        
        return columnDef;
      });
      
      setColumnDefs(columns);
      
      // Calculate total pages
      setTotalPages(Math.ceil(data.length / rowsPerPage));
    }
  }, [data, rowsPerPage]);

  const exportToExcel = () => {
    if (gridRef.current && gridRef.current.api) {
      // Export all data, not just the current page
      const params = {
        fileName: `${title.replace(/\s+/g, '_')}_${currentDateTime}`,
        allColumns: true,
        processCellCallback: (params) => {
          // Format date fields for Excel export - only process cells that appear to be dates
          if (params.value && 
              typeof params.value === 'string' && 
              params.value.includes('T') && 
              params.column.getColId().toLowerCase().includes('date')) {
            try {
              return formatDateToIST(params.value);
            } catch (e) {
              return params.value;
            }
          }
          return params.value;
        }
      };
      
      // Get all visible data for the current filtered/sorted state
      const allData = [];
      gridRef.current.api.forEachNode(node => {
        if (node.data) {
          allData.push(node.data);
        }
      });
      
      // Store current pagination state
      const currentPaginationState = {
        page: currentPage,
        data: currentPageData
      };
      
      // Set all data for export
      gridRef.current.api.setRowData(data);
      
      // Export
      gridRef.current.api.exportDataAsExcel(params);
      
      // Restore pagination state
      gridRef.current.api.setRowData(currentPaginationState.data);
      
      toast.success('Downloaded Successfully');
    }
  };

  const paginationButtons = () => {
    const buttons = [];
    const maxPagesToShow = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    
    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    // Previous button
    buttons.push(
      <Button
        key="prev"
        variant="outline"
        size="sm"
        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
        disabled={currentPage === 1}
        className="px-3"
      >
        &lt;
      </Button>
    );
    
    // Page number buttons
    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <Button
          key={i}
          variant={currentPage === i ? "secondary" : "outline"}
          size="sm"
          onClick={() => setCurrentPage(i)}
          className="px-3"
        >
          {i}
        </Button>
      );
    }
    
    // Next button
    buttons.push(
      <Button
        key="next"
        variant="outline"
        size="sm"
        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
        disabled={currentPage === totalPages}
        className="px-3"
      >
        &gt;
      </Button>
    );
    
    return buttons;
  };

  // Compute the data for the current page
  const currentPageData = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return data.slice(startIndex, endIndex);
  }, [data, currentPage, rowsPerPage]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-8xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
          <div className="flex justify-between items-center mt-4">
            <div className="flex items-center">
              <select 
                className="border rounded p-1 mr-2 text-sm"
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={20}>20 rows</option>
                <option value={30}>30 rows</option>
                <option value={50}>50 rows</option>
                <option value={100}>100 rows</option>
              </select>
              <span className="text-sm">
                Page {currentPage} of {totalPages} ({data.length} records)
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={exportToExcel}>
              <RiFileExcel2Fill className="w-5 h-5 text-green-700 mr-1" />
              <span>Download Excel</span>
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex-grow overflow-scroll mt-2">
          <div 
            className="ag-theme-quartz h-full w-full"
            style={{ ...gridTheme, height: "450px" }}
          >
            <AgGridReact
              ref={gridRef}
              rowData={currentPageData}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              animateRows={true}
              pagination={false}
              suppressScrollOnNewData={true}
              suppressMovableColumns={false}
              enableRangeSelection={true}
              enableAdvancedFilter={false}
              autoSizeStrategy={autoSizeStrategy}
              rowSelection="multiple"
              suppressCellFocus={false}
              skipHeaderOnAutoSize={false}
              domLayout="autoHeight"
            />
          </div>
        </div>
        
        <div className="flex justify-center mt-4 space-x-1">
          {paginationButtons()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TableDialog;