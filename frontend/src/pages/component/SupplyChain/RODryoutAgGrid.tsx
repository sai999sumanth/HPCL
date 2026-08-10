import React, { useState, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { Card, CardHeader, CardTitle, CardContent } from '@/@/components/ui/card';
import { Button } from '@/@/components/ui/button';
import { Loader2, Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

const DynamicAgGrid = () => {
  const [gridData, setGridData] = useState([]);
  const [columnDefs, setColumnDefs] = useState([]);
  const [isTableExpanded, setIsTableExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasData, setHasData] = useState(false);
  
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.post('/api/charts/generate_vis_data', {
        filters: [],
        action: "dry_out_ro_loss",
        drill_state: "",
        cross_filters: [],
        limit: 0,
        time_grain: "",
        resp_format: "",
        resp_level: "all"
      });

      if (response.data && response.data.data) {
        // Set grid data from response
        setGridData(response.data.data);
        setHasData(response.data.data.length > 0);
        
        // Dynamically create column definitions from the first data item
        if (response.data.data.length > 0) {
          const firstRow = response.data.data[0];
          const cols = Object.keys(firstRow).map(key => ({
            headerName: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
            field: key,
            sortable: true,
            filter: true,
            resizable: true
          }));
          setColumnDefs(cols);
        }
      } else {
        setHasData(false);
        setError('No data found in the response');
      }
    } catch (err) {
      setError(`Error fetching data: ${err.message}`);
      console.error('Error fetching data:', err);
      setHasData(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);
  
  const toggleTableExpand = () => {
    setIsTableExpanded(!isTableExpanded);
  };
  
  const handleRefresh = () => {
    fetchData();
  };

  // Generate row data for grid
  const filteredGridData = gridData || [];

  return (
    <div className="flex flex-col gap-2 p-1">
      <div className="w-full">
        {isTableExpanded && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={toggleTableExpand} />
        )}
        <Card
          className={`transition-all duration-300 ${
            isTableExpanded ? "fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl" : ""
          }`}
        >
          <CardHeader className="pb-0 p-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold text-gray-800">
                Dry Out RO Loss Details
              </CardTitle>
              <div className="flex items-center gap-2">
                {/* Refresh Button */}
                <Button
                  onClick={handleRefresh}
                  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  disabled={isLoading}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                
                {/* Expand Button */}
                <Button
                  onClick={toggleTableExpand}
                  className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-blue-600 hover:bg-blue-700"
                >
                  {isTableExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-1 pt-0 relative">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            )}

            {error && ( 
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-white/80 z-10">
                <p>No Data</p>
              </div>
            )}
            
            {!hasData && !isLoading && !error && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-white/80 z-10">
                <p>No data available for the selected filters</p>
              </div>
            )}

            <div
              className="ag-theme-alpine"
              style={{
                height: isTableExpanded ? "calc(100vh - 8rem)" : "357px",
                width: "100%",
              }}
            >
              <AgGridReact
                columnDefs={columnDefs}
                rowData={filteredGridData}
                defaultColDef={{
                  sortable: true,
                  filter: true,
                  resizable: true,
                }}
                pagination={true}
                paginationPageSize={isTableExpanded ? 20 : 10}
                enableCellTextSelection={true}
                suppressCellFocus={true}
                domLayout="normal"
                headerHeight={25}
                rowHeight={25}
                suppressMovableColumns={false}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DynamicAgGrid;