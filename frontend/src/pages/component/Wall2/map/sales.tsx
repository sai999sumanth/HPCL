


import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/@/components/ui/dialog';
import { Button } from '@/@/components/ui/button';
import { Badge } from '@/@/components/ui/badge';
import { Input } from '@/@/components/ui/input';
import { TrendingUp, ChevronLeft, ChevronRight, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, Loader2, AlertTriangle, Download, Users, Phone } from 'lucide-react';
import { apiClient } from '../../../../services/apiClient';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import clsx from 'clsx';

interface SalesData {
  SBU?: string;
  SAP_ID?: string;
  SALES_AREA?: string;
  FISCAL_YEAR?: string;
  'NETWEIGHT (TMT)'?: number;
}

interface OfficerData {
  username?: string;
  first_name?: string;
  last_name?: string;
  novex_role?: string[];
  contact_number?: string;
  sap_id?: string;
}

interface SalesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: {
    sap_id?: string;
    location_name?: string;
    name?: string;
    company?: string;
    sbu?: string;
  } | null;
  initialTab?: 'sales' | 'officers';
}

const SalesDialog: React.FC<SalesDialogProps> = ({
  open,
  onOpenChange,
  location,
  initialTab = 'sales',
}) => {
  const [activeTab, setActiveTab] = useState<'sales' | 'officers'>(initialTab);
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [officerData, setOfficerData] = useState<OfficerData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [rotating, setRotating] = useState(false);
  const gridRef = useRef<AgGridReact>(null);

  // Update active tab when initialTab changes
  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  // Fetch sales data when dialog opens
  useEffect(() => {
    if (!open || !location?.sap_id) {
      setSalesData([]);
      return;
    }

    const fetchSalesData = async () => {
      setIsLoading(true);
      try {
        const payload = {
          filters: [
            {
              key: 'sap_id',
              cond: '=',
              value: location.sap_id,
            },
          ],
          drill_state: '',
          cross_filters: [],
          limit: 0,
          time_grain: '',
        };

        const response = await apiClient.post('/api/sodinfra/get_sales_infra', payload);
        const data = response.data?.data || response.data || [];
        setSalesData(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching sales data:', error);
        setSalesData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSalesData();
  }, [open, location]);

  // Fetch officer data when dialog opens
  useEffect(() => {
    if (!open || !location?.sap_id || !location?.sbu) {
      setOfficerData([]);
      return;
    }

    const fetchOfficerData = async () => {
      try {
        const payload = {
          sbu: location.sbu || 'SOD',
          sap_id: location.sap_id,
        };

        const response = await apiClient.post('/api/sodinfra/get_sales_officer_infra', payload);
        const data = response.data?.data || response.data || [];
        setOfficerData(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching officer data:', error);
        setOfficerData([]);
      }
    };

    fetchOfficerData();
  }, [open, location]);

  // Auto-size columns when data loads
  useEffect(() => {
    if (salesData.length > 0 && gridRef.current?.api) {
      setTimeout(() => {
        // Auto-size columns based on content, then fit to available space
        gridRef.current?.api.autoSizeAllColumns();
        gridRef.current?.api.sizeColumnsToFit();
      }, 100);
    }
  }, [salesData]);

  // Column definitions for AG Grid - Sales
  const columnDefs = useMemo<ColDef[]>(() => {
    if (activeTab === 'sales') {
      if (!salesData || salesData.length === 0) return [];

      return [
        {
          field: 'SBU',
          headerName: 'SBU',
          sortable: true,
          resizable: true,
          filter: false,
          flex: 1,
          minWidth: 100,
          cellStyle: { textAlign: 'center', fontSize: '12px' },
          headerStyle: { textAlign: 'center' },
          valueFormatter: (params) => params.value || '-',
        },
        {
          field: 'SAP_ID',
          headerName: 'SAP ID',
          sortable: true,
          resizable: true,
          filter: false,
          flex: 1,
          minWidth: 100,
          cellStyle: { textAlign: 'center', fontSize: '12px' },
          headerStyle: { textAlign: 'center' },
          valueFormatter: (params) => params.value || '-',
        },
        {
          field: 'SALES_AREA',
          headerName: 'SALES AREA',
          sortable: true,
          resizable: true,
          filter: false,
          flex: 2,
          minWidth: 150,
          cellStyle: { textAlign: 'center', fontSize: '12px' },
          headerStyle: { textAlign: 'center' },
          valueFormatter: (params) => params.value || '-',
        },
        {
          field: 'FISCAL_YEAR',
          headerName: 'FISCAL YEAR',
          sortable: true,
          resizable: true,
          filter: false,
          flex: 1,
          minWidth: 120,
          cellStyle: { textAlign: 'center', fontSize: '12px' },
          headerStyle: { textAlign: 'center' },
          valueFormatter: (params) => params.value || '-',
        },
        {
          field: 'NETWEIGHT (TMT)',
          headerName: 'NETWEIGHT (TMT)',
          sortable: true,
          resizable: true,
          filter: false,
          flex: 1,
          minWidth: 150,
          cellStyle: { textAlign: 'center', fontSize: '12px' },
          headerStyle: { textAlign: 'center' },
          valueFormatter: (params) => {
            const value = params.value;
            return value !== null && value !== undefined
              ? Number(value).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : '0.00';
          },
        },
      ];
    } else {
      // Officers tab
      if (!officerData || officerData.length === 0) return [];

      return [
        {
          field: 'name',
          headerName: 'NAME',
          sortable: true,
          resizable: true,
          filter: false,
          flex: 2,
          minWidth: 10,
          cellStyle: { textAlign: 'center', fontSize: '12px' },
          headerStyle: { textAlign: 'left' },
          valueGetter: (params) => {
            const first = params.data?.first_name || '';
            const last = params.data?.last_name || '';
            return `${first} ${last}`.trim() || '-';
          },
        },
        {
          field: 'username',
          headerName: 'USER ID',
          sortable: true,
          resizable: true,
          filter: false,
          flex: 1,
          minWidth: 10,
          cellStyle: { textAlign: 'center', fontSize: '12px' },
          headerStyle: { textAlign: 'center' },
          valueFormatter: (params) => params.value || '-',
        },
        {
          field: 'novex_role',
          headerName: 'ROLES',
          sortable: true,
          resizable: true,
          filter: false,
          flex: 1,
          minWidth: 700,
          cellStyle: { textAlign: 'center', fontSize: '12px' },
          headerStyle: { textAlign: 'center' },
          valueFormatter: (params) => {
            if (Array.isArray(params.value) && params.value.length > 0) {
              return params.value.join(', ');
            }
            return '-';
          },
        },
        {
          field: 'contact_number',
          headerName: 'CONTACT',
          sortable: true,
          resizable: true,
          filter: false,
          flex: 1,
          minWidth: 130,
          cellStyle: { textAlign: 'center', fontSize: '12px' },
          headerStyle: { textAlign: 'center' },
          valueFormatter: (params) => params.value || '-',
        },
      ];
    }
  }, [salesData, officerData, activeTab]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    enableCellTextSelection: true,
    suppressMovable: false,
    cellStyle: { fontSize: '12px' },
  }), []);

  // Download Excel function
  const downloadExcel = useCallback(async () => {
    if (!location?.sap_id || salesData.length === 0) {
      toast.error('No data available to download');
      return;
    }

    setIsDownloading(true);
    try {
      const payload = {
        filters: [
          {
            key: 'sap_id',
            cond: '=',
            value: location.sap_id,
          },
        ],
        drill_state: '',
        cross_filters: [],
        limit: 0,
        time_grain: '',
      };

      const response = await apiClient.post('/api/sodinfra/get_sales_infra', payload);
      const data = response.data?.data || response.data || [];
      const salesDataArray = Array.isArray(data) ? data : [];

      const excelData = salesDataArray.map((item: SalesData) => ({
        'SBU': item.SBU || '-',
        'SAP ID': item.SAP_ID || '-',
        'SALES AREA': item.SALES_AREA || '-',
        'FISCAL YEAR': item.FISCAL_YEAR || '-',
        'NETWEIGHT (TMT)': item['NETWEIGHT (TMT)'] !== null && item['NETWEIGHT (TMT)'] !== undefined
          ? Number(item['NETWEIGHT (TMT)']).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : '0.00',
      }));

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      const colWidths = Object.keys(excelData[0] || {}).map(key => ({
        wch: Math.max(
          key.length,
          ...excelData.map(row => String(row[key as keyof typeof row] || '').length)
        )
      }));
      worksheet['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Data');

      const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
      const filename = `Sales_Data_${location.sap_id}_${timestamp}.xlsx`;

      XLSX.writeFile(workbook, filename);

      toast.success(`Excel file downloaded: ${filename}`);
    } catch (error) {
      console.error('Error downloading Excel:', error);
      toast.error('Failed to download Excel file');
    } finally {
      setIsDownloading(false);
    }
  }, [location, salesData]);

  // Refresh function
  const handleRefresh = useCallback(() => {
    setRotating(true);
    setSearchQuery('');
    
    if (location?.sap_id) {
      const fetchSalesData = async () => {
        setIsLoading(true);
        try {
          const payload = {
            filters: [
              {
                key: 'sap_id',
                cond: '=',
                value: location.sap_id,
              },
            ],
            drill_state: '',
            cross_filters: [],
            limit: 0,
            time_grain: '',
          };

          const response = await apiClient.post('/api/sodinfra/get_sales_infra', payload);
          const data = response.data?.data || response.data || [];
          setSalesData(Array.isArray(data) ? data : []);
        } catch (error) {
          console.error('Error fetching sales data:', error);
          setSalesData([]);
        } finally {
          setIsLoading(false);
        }
      };
      fetchSalesData();
    }
    
    setTimeout(() => {
      setRotating(false);
    }, 1000);
  }, [location]);

  if (!location) return null;

  const locationName = location.location_name || location.name || 'Location';
  const locationDisplay = location.company 
    ? `${location.company}, ${locationName}` 
    : locationName;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[170vw] w-[98vw] h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-3 pt-1 pb-0 bg-white mb-0">
          <div className="flex items-center justify-between mb-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gray-100 rounded-lg">
                {activeTab === 'sales' ? (
                  <TrendingUp className="w-4 h-4 text-gray-600" />
                ) : (
                  <Users className="w-4 h-4 text-gray-600" />
                )}
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-gray-900 whitespace-nowrap mb-0">
                  {activeTab === 'sales' ? `Sales Performance (${locationDisplay})` : `Plant Officers (${locationDisplay})`}
                </DialogTitle>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Navigation - Outside Header */}
        <div className="flex gap-2 px-6 border-b border-gray-200 bg-white -mt-1">
          <button
            onClick={() => {
              setActiveTab('sales');
              setSearchQuery('');
            }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'sales'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Sales Performance
          </button>
          <button
            onClick={() => {
              setActiveTab('officers');
              setSearchQuery('');
            }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'officers'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Plant Officers
          </button>
                </div>

        <div className="flex-1 overflow-hidden  -mt-2 flex flex-col bg-white px-4">
          {/* Search, Download and Refresh Bar */}
          <div className="flex justify-between items-center mb-1 space-x-2 py-1">
            <div className="flex-grow">
              <Input
                placeholder="Search table..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8"
              />
                    </div>

                          <Button
                            variant="outline"
                            size="sm"
              onClick={downloadExcel}
              disabled={isDownloading || salesData.length === 0}
                          >
              <Download className={clsx("mr-2 h-4 w-4", { "animate-spin": isDownloading })} />
              {isDownloading ? 'Downloading...' : 'Download'}
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw
                className={clsx("mr-2 h-4 w-4 transition-transform", {
                  "animate-spin": rotating || isLoading,
                })}
              />
              Refresh
                          </Button>
                        </div>

                {isLoading ? (
                  <div className="flex items-center justify-center flex-1">
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                      <span className="text-gray-700 font-medium mt-3 text-sm">
                        Loading table data...
                      </span>
                  </div>
                  </div>
                ) : (activeTab === 'sales' ? salesData.length : officerData.length) === 0 ? (
                  <div className="flex items-center justify-center flex-1">
                    <div className="text-center bg-white rounded-lg border border-gray-200 p-12">
                      {activeTab === 'sales' ? (
                        <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      ) : (
                        <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      )}
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {activeTab === 'sales' ? 'No Sales Data Available' : 'No Officer Data Available'}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {activeTab === 'sales' 
                          ? 'There is no sales data available for this location at the moment.'
                          : 'There is no officer data available for this location at the moment.'
                        }
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <style>{`
                      .ag-theme-alpine .ag-header-cell-label {
                        justify-content: center;
                        text-align: center;
                      }
                      .ag-theme-alpine .ag-header-cell-text {
                        text-align: center;
                        width: 100%;
                      }
                      .ag-theme-alpine .ag-cell {
                        padding-left: 8px;
                        padding-right: 8px;
                      }
                      .ag-theme-alpine .ag-header-cell {
                        padding-left: 8px;
                        padding-right: 8px;
                        background-color:rgb(55, 108, 223) !important;
                        color: white !important;
                      }
                      .ag-theme-alpine .ag-header {
                        background-color:rgb(55, 108, 223) !important;
                      }
                      .ag-theme-alpine .ag-row {
                        border-bottom-width: 0.5px;
                      }
                    `}</style>
                    <div style={{ height: '500px', width: '100%' }}>
                      {columnDefs.length > 0 ? (
                        <div className="ag-theme-alpine" style={{ height: '100%', width: '100%', userSelect: 'text', WebkitUserSelect: 'text' }}>
                          <AgGridReact
                            ref={gridRef}
                            rowData={activeTab === 'sales' ? salesData : officerData}
                            columnDefs={columnDefs}
                            defaultColDef={defaultColDef}
                            pagination={true}
                            paginationPageSize={50}
                            paginationPageSizeSelector={[10, 20, 50, 100]}
                            animateRows={false}
                            suppressRowClickSelection={true}
                            suppressCellFocus={true}
                            suppressScrollOnNewData={true}
                            enableRangeSelection={true}
                            enableCellTextSelection={true}
                            ensureDomOrder={true}
                            quickFilterText={searchQuery}
                            rowBuffer={20}
                            debounceVerticalScrollbar={true}
                            suppressAggFuncInHeader={true}
                            suppressMenuHide={true}
                            rowHeight={36}
                            headerHeight={36}
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                          <AlertTriangle className="w-10 h-10 mb-2" />
                          <span className="text-sm font-medium">
                            No table data available
                          </span>
                  </div>
                )}
          </div>
                  </div>
                )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SalesDialog;