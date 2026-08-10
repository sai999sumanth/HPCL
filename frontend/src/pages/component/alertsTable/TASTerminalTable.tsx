import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ClientSideRowModelModule, ColDef, ModuleRegistry, SizeColumnsToContentStrategy, SizeColumnsToFitGridStrategy, SizeColumnsToFitProvidedWidthStrategy, } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
// Removed enterprise modules - using community only
ModuleRegistry.registerModules([
  ClientSideRowModelModule
]);
import { 
  RefreshCw, 
  Loader2
} from 'lucide-react';
import { Input } from "@/@/components/ui/input";
import { RiRefreshLine } from "react-icons/ri";
// Import AG Grid styles - for version 31.0.4, we use the new modular themes
import "ag-grid-community/styles/ag-theme-quartz.css";
import "ag-grid-community/styles/ag-grid.css"
import { Button } from "@/@/components/ui/button";
import { RiFileExcel2Fill } from "react-icons/ri";
import { CustomMultiSelect } from "@/@/components/ui/custom-multiselect";
import axios from "axios";
import dayjs from "dayjs";
import { toast } from "sonner";
// import ApiLoader from "@/services/apiLoader"; // Remove this import
import { apiClient } from "@/services/apiClient";

interface IRow {
  sap_id: number;
  name: string;
  zone: number;
  device_type: string;
}
interface TerminalTableProps {
  zone?: string;
  plant?: string;
}


const TerminalTable: React.FC<TerminalTableProps> = ({ zone = "NCZ", plant = "1128" }) => {
  const [dryoutData, setDryoutData] = useState([]);
  const [dryoutColumn, setDryoutColumn] = useState([]);
  const gridStyle = useMemo(() => ({ height: "100%", width: "100%" }), []);
  const gridRef = useRef<AgGridReact<any>>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [pageSize, setPageSize] = useState<number>(20);
  const [filteredData, setFilteredData] = useState<IRow[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [rowData, setRowData] = useState([]);
  const columnDefs: ColDef[] = [
    { headerName: "Zone", field: "zone", sortable: true,    filter: false, 
      suppressMenu: true,  resizable: true },

    { headerName: "Plant", field: "name", sortable: true,     filter: false, 
      suppressMenu: true,  resizable: true },
    { headerName: "SAP ID", field: "sap_id", sortable: true,     filter: false, 
      suppressMenu: true,  resizable: true },
    { headerName: "System", field: "system", sortable: true,     filter: false, 
      suppressMenu: true,  resizable: true },

    // { headerName: "Device Type", field: "device_type", sortable: true, filter: true, resizable: true },
    { headerName: "Total Device connected",
       field: "count", 
       sortable: true, 
       filter: false, 
       suppressMenu: true, 
      //  filter: "agNumberColumnFilter", 
       resizable: true },
    { headerName: "Device under maintenance/Fault", field: "mf_count", sortable: true, 
      // filter: "agNumberColumnFilter", 
      filter: false, 
      suppressMenu: true, 
      resizable: true },

  ];


  const defaultColDef: ColDef = {
    flex: 1,
    resizable: true,
    floatingFilter: false,
    suppressSizeToFit: true
  };

  // Theme configuration using AG Grid 33.0.4's theme parameters
  const gridTheme = {
    '--ag-header-height': '40px',
    // '--ag-header-foreground-color': 'white',
    '--ag-header-foreground-color': 'black', 
    '--ag-header-background-color': 'rgba(239, 239, 239, 0.98)',
    // '--ag-header-background-color': 'rgba(214, 215, 216, 0.98)',
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

  // Combined useEffect that only runs when zone or plant change
  useEffect(() => {
    fetchData();
  }, [zone, plant]);


  const fetchData = async () => {  
    setIsLoading(true);
    try {
      const response = await apiClient.post('/api/tagsdata/get_tags_data', {
        zone: zone,
        plant: plant
      });  
      if (response.status !== 200) {
        toast.error(`Error: ${response.status}`);
        return;
      }
  
      if (response.data?.status && Array.isArray(response.data?.data)) {
        setDryoutData(response.data.data);
        setFilteredData(response.data.data);
      } else {
        setDryoutData([]);
        setFilteredData([]);
      }
    } catch (error) {
      toast.error(`API Error: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  const autoSizeStrategy = useMemo<
    | SizeColumnsToFitGridStrategy
    | SizeColumnsToFitProvidedWidthStrategy
    | SizeColumnsToContentStrategy
  >(() => {
    return {
      type: "fitCellContents",
      defaultMinWidth: 200
    };
  }, []);

  // Handle Search Input
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);
  
    if (query) {
      const filtered = dryoutData.filter((row) =>
        Object.values(row).some(value =>
          value?.toString().toLowerCase().includes(query)
        )
      );
      setFilteredData(filtered);
    } else {
      setFilteredData(dryoutData);
    }
  };

  return (
    <div className="p-0">
      <h2 className="text-xs font-bold">Summary Table</h2>

      <div style={gridStyle}>
        {/* Search & Refresh Bar */}
        <div className="flex justify-between items-center mb-1 mt-1 space-x-2">
          <div className="flex-grow">
            <Input
              placeholder="Search alerts..."
              value={searchQuery}
              onChange={handleSearch}
              className="w-full h-8"
            />
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchData}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>

        <div className="ag-theme-alpine w-full mb-1 relative" style={{ height: "250px" }}>
          {/* Local Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center">
              <div className="flex flex-col items-center space-y-2">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <p className="text-sm text-gray-600">Loading data...</p>
              </div>
            </div>
          )}

          <style>
            {`
            .custom-header {
              font-size: 12px !important;
              font-weight: bold;
            }
            .ag-row-odd {
              background-color: #f9fafb;
            }
            .text-red-500 {
              color: #ef4444 !important;
            }
            .text-green-500 {
              color: #10b981 !important;
            }
            .text-blue-500 {
              color: #3b82f6 !important;
            }
            .text-gray-500 {
              color: #6b7280 !important;
            }
            .text-amber-500 {
              color: #f59e0b !important;
            }
          `}
          </style>
          <AgGridReact
            ref={gridRef}
            columnDefs={columnDefs} // Defined Column Names
            defaultColDef={defaultColDef}
            rowData={filteredData}
            animateRows={true}
            headerHeight={25}
            rowHeight={25}
            pagination={true}
            paginationPageSize={pageSize}
            suppressMovableColumns={false}
            suppressContextMenu={true}
            suppressMenuHide={true}
            suppressRowClickSelection={true}
          />
        </div>
      </div>
    </div>
  );
};

export default TerminalTable;