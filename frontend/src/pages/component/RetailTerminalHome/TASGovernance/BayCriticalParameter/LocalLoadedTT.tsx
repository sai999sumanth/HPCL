import React, { useEffect, useState, useCallback, useRef } from 'react';
import { apiClient } from '@/services/apiClient';
import { Loader2, AlertCircle, Search, XCircle } from 'lucide-react';
// import { Download } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/@/components/ui/dialog';
import { toast } from 'sonner';
// import * as XLSX from 'xlsx';

interface LocalLoadedTTProps {
  selectedBu: string;
  selectedZone: string | null;
  selectedPlant: string | null;
  selectedTimeFilter: string | null | { key: string; cond: string; value: string };
  refreshKey: number;
  plantData?: Array<{ id: string; name: string }>;
}

interface LocalLoadingRepeatedDetail {
  date?: string;
  date_with_time?: string;
  truck_number?: string;
  user_id?: string | null;
  loaded_qty?: number;
  bay_number?: string;
  count?: number;
}

interface ParticularTimeOfDayDetail {
  truck_number?: string;
  date_with_time?: string;
}

interface AssignedAtParticularBayDetail {
  truck_number?: string;
  bay_number?: string;
  bcu_number?: string;
  date?: string;
}

interface IndentRequestDetail {
  truck_number?: string;
  date?: string;
  user_id?: string | null;
  vendor_name?: string | null;
}

interface LocalLoadedTTData {
  location_name?: string;
  sap_id?: string;
  total_loaded_qty?: number;
  breakdown?: {
    dg?: number;
    tank_truck?: number;
    prover?: number;
  };
  local_loading_repeated?: boolean;
  local_loading_repeated_details?: LocalLoadingRepeatedDetail[];
  particular_product?: boolean;
  particular_time_of_day?: boolean;
  particular_time_of_day_details?: ParticularTimeOfDayDetail[];
  assigned_at_particular_bay?: boolean | {
    truck_number?: string;
    assigned_bay?: string;
    reassigned_bay?: string;
    reassign_loaded_qty?: number;
  };
  assigned_at_particular_bay_details?: AssignedAtParticularBayDetail[];
  indent_request_details?: IndentRequestDetail[] | null;
  [key: string]: any;
}

const LocalLoadedTT: React.FC<LocalLoadedTTProps> = ({
  selectedBu,
  selectedZone,
  selectedPlant,
  selectedTimeFilter,
  refreshKey,
  plantData: plantDataProp = [],
}) => {
  const [data, setData] = useState<LocalLoadedTTData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plantData, setPlantData] = useState<Array<{ id: string; name: string }>>([]);
  const [isBreakdownDialogOpen, setIsBreakdownDialogOpen] = useState(false);
  const [selectedBreakdown, setSelectedBreakdown] = useState<{
    dg?: number;
    tank_truck?: number;
    prover?: number;
  } | null>(null);
  const [selectedItemInfo, setSelectedItemInfo] = useState<{
    location_name?: string;
    sap_id?: string;
    total_loaded_qty?: number;
  } | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedDetails, setSelectedDetails] = useState<{
    type: 'local_loading_repeated' | 'particular_time_of_day';
    title: string;
    location_name?: string;
    sap_id?: string;
    details?: LocalLoadingRepeatedDetail[] | ParticularTimeOfDayDetail[];
  } | null>(null);
  const [isIndentRequestDialogOpen, setIsIndentRequestDialogOpen] = useState(false);
  const [selectedIndentRequestDetails, setSelectedIndentRequestDetails] = useState<{
    location_name?: string;
    sap_id?: string;
    details?: IndentRequestDetail[];
  } | null>(null);
  const [isAssignedAtBayDialogOpen, setIsAssignedAtBayDialogOpen] = useState(false);
  const [selectedAssignedAtBayDetails, setSelectedAssignedAtBayDetails] = useState<{
    location_name?: string;
    sap_id?: string;
    details?: AssignedAtParticularBayDetail[];
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRowIndex, setExpandedRowIndex] = useState<number | null>(null);
  const plantDataRef = useRef<Array<{ id: string; name: string }>>([]);

  // Convert time filter to date range
  const getDateRange = useCallback(() => {
    const now = new Date();
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (selectedTimeFilter && typeof selectedTimeFilter === 'object' && 'value' in selectedTimeFilter) {
      // Custom date range - value format: "startDate,endDate"
      const dateRangeStr = selectedTimeFilter.value;
      if (dateRangeStr && dateRangeStr.includes(',')) {
        const [startDate, endDate] = dateRangeStr.split(',').map(d => d.trim());
        if (startDate && endDate) {
          return { start_date: startDate, end_date: endDate };
        }
      }
      // Fallback to default if parsing fails
      const s = new Date(now);
      s.setDate(s.getDate() - 15);
      return { start_date: fmt(s), end_date: fmt(now) };
    }

    switch (selectedTimeFilter) {
      case 'TDY':
      case 't':
        return { start_date: fmt(now), end_date: fmt(now) };
      case 'YDY':
      case '1d': {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        return { start_date: fmt(y), end_date: fmt(y) };
      }
      case '1W':
      case '1w': {
        const s = new Date(now);
        s.setDate(s.getDate() - 7);
        return { start_date: fmt(s), end_date: fmt(now) };
      }
      case '15D':
      case '15d': {
        const s = new Date(now);
        s.setDate(s.getDate() - 15);
        return { start_date: fmt(s), end_date: fmt(now) };
      }
      case '1M':
      case '1m': {
        const s = new Date(now);
        s.setDate(s.getDate() - 30);
        return { start_date: fmt(s), end_date: fmt(now) };
      }
      case '3M':
      case '3m': {
        const s = new Date(now);
        s.setDate(s.getDate() - 90);
        return { start_date: fmt(s), end_date: fmt(now) };
      }
      default: {
        const s = new Date(now);
        s.setDate(s.getDate() - 15);
        return { start_date: fmt(s), end_date: fmt(now) };
      }
    }
  }, [selectedTimeFilter]);

  // Use plant data from parent (fetched once at dashboard level)
  useEffect(() => {
    setPlantData(plantDataProp);
    plantDataRef.current = plantDataProp;
  }, [plantDataProp]);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const dateRange = getDateRange();
      
      // Find plant name from plantDataRef
      const selectedPlantObj = plantDataRef.current.find(p => p.id === selectedPlant);
      const plantName = selectedPlantObj ? selectedPlantObj.name : (selectedPlant || "");
      
      console.log('LocalLoadedTT - Selected Plant ID:', selectedPlant);
      console.log('LocalLoadedTT - Plant Data:', plantDataRef.current);
      console.log('LocalLoadedTT - Found Plant:', selectedPlantObj);
      console.log('LocalLoadedTT - Using Plant Name:', plantName);
      
      const payload = {
        analytical_model: "Location Wise Total Loaded Qty",
        location_name: plantName,
        interlock_name: "",
        alert_status: "",
        alert_severity: [],
        zone: selectedZone || "",
        start_date: dateRange.start_date,
        end_date: dateRange.end_date,
        equipment_type: "",
        equipment_name: "",
        download: ""
      };
      
      console.log('LocalLoadedTT - API Payload:', payload);

      const response = await apiClient.post('/api/tasanalytics/tas_analytics', payload);

      if (response && response.data) {
        let dataArray: LocalLoadedTTData[] = [];

        if (Array.isArray(response.data)) {
          dataArray = response.data;
        } else if (typeof response.data === 'object' && response.data !== null) {
          dataArray = Object.values(response.data);
        }

        // Map response data - handle different possible field names
        const mappedData = dataArray.map((item: any) => ({
          ...item,
          location_name: item.location_name || item.location || item.name || '',
          sap_id: item.sap_id || '',
          total_loaded_qty: item.total_loaded_qty || 0,
          breakdown: item.breakdown || null,
          local_loading_repeated: item.local_loading_repeated,
          local_loading_repeated_details: item.local_loading_repeated_details || [],
          particular_product: item.particular_product,
          particular_time_of_day: item.particular_time_of_day,
          particular_time_of_day_details: item.particular_time_of_day_details || [],
          assigned_at_particular_bay: item.assigned_at_particular_bay,
          assigned_at_particular_bay_details: item.assigned_at_particular_bay_details || [],
          indent_request_details: item.indent_request_details || null
        }));

        setData(mappedData);
      } else {
        setData([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch Local Loaded TT data:', err);
      setError(err?.response?.data?.message || err.message || 'Failed to load data');
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedZone, selectedPlant, getDateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  // Helper function to format nested objects
  const formatNestedObject = (obj: any): string => {
    if (!obj || typeof obj !== 'object') return '-';
    return Object.entries(obj)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  };

  // Helper function to format boolean values
  const formatBoolean = (value: boolean | undefined): string => {
    if (value === undefined || value === null) return '-';
    return value ? 'Yes' : 'No';
  };

  // Handle click on total loaded qty
  const handleTotalLoadedQtyClick = (item: LocalLoadedTTData) => {
    if (item.breakdown) {
      setSelectedBreakdown(item.breakdown);
      setSelectedItemInfo({
        location_name: item.location_name,
        sap_id: item.sap_id,
        total_loaded_qty: item.total_loaded_qty
      });
      setIsBreakdownDialogOpen(true);
    }
  };

  // Handle click on truck number
  const handleTruckNumberClick = (index: number) => {
    setExpandedRowIndex(expandedRowIndex === index ? null : index);
  };

  // Handle click on local loading repeated
  const handleLocalLoadingRepeatedClick = (item: LocalLoadedTTData) => {
    if (item.local_loading_repeated && item.local_loading_repeated_details) {
      setSelectedDetails({
        type: 'local_loading_repeated',
        title: 'Local Loading Repeated Details',
        location_name: item.location_name,
        sap_id: item.sap_id,
        details: item.local_loading_repeated_details
      });
      setIsDetailsDialogOpen(true);
    }
  };

  // Handle click on particular time of day
  const handleParticularTimeOfDayClick = (item: LocalLoadedTTData) => {
    if (item.particular_time_of_day && item.particular_time_of_day_details) {
      setSelectedDetails({
        type: 'particular_time_of_day',
        title: 'Particular Time of Day Details',
        location_name: item.location_name,
        sap_id: item.sap_id,
        details: item.particular_time_of_day_details
      });
      setIsDetailsDialogOpen(true);
    }
  };

  // Handle click on assigned at particular bay details
  const handleAssignedAtParticularBayClick = (item: LocalLoadedTTData) => {
    if (item.assigned_at_particular_bay_details && item.assigned_at_particular_bay_details.length > 0) {
      setSelectedAssignedAtBayDetails({
        location_name: item.location_name,
        sap_id: item.sap_id,
        details: item.assigned_at_particular_bay_details
      });
      setIsAssignedAtBayDialogOpen(true);
    }
  };

  // Handle click on indent request details
  const handleIndentRequestDetailsClick = (item: LocalLoadedTTData) => {
    if (item.indent_request_details && Array.isArray(item.indent_request_details) && item.indent_request_details.length > 0) {
      setSelectedIndentRequestDetails({
        location_name: item.location_name,
        sap_id: item.sap_id,
        details: item.indent_request_details
      });
      setIsIndentRequestDialogOpen(true);
    }
  };

  // const handleDownload = async () => {
  //   try {
  //     const dateRange = getDateRange();
  //     
  //     // Find plant name from plantData
  //     const selectedPlantObj = plantData.find(p => p.id === selectedPlant);
  //     const plantName = selectedPlantObj ? selectedPlantObj.name : "";
  //     
  //     const payload = {
  //       analytical_model: "Location Wise Total Loaded Qty",
  //       location_name: selectedPlant || "",
  //       interlock_name: plantName,
  //       alert_status: "",
  //       alert_severity: [],
  //       zone: selectedZone || "",
  //       start_date: dateRange.start_date,
  //       end_date: dateRange.end_date,
  //       equipment_type: "",
  //       equipment_name: "",
  //       download: "true"
  //     };

  //     const response = await apiClient.post('/api/tasanalytics/tas_analytics', payload, {
  //       responseType: 'blob'
  //     });

  //     // Create blob from response
  //     const blob = new Blob([response.data], { 
  //       type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  //     });
  //     
  //     // Create download link
  //     const url = window.URL.createObjectURL(blob);
  //     const link = document.createElement('a');
  //     link.href = url;
  //     link.download = `local_loaded_tt_${new Date().toISOString().split('T')[0]}.xlsx`;
  //     document.body.appendChild(link);
  //     link.click();
  //     document.body.removeChild(link);
  //     window.URL.revokeObjectURL(url);
  //     
  //     toast.success("Data downloaded successfully");
  //   } catch (err) {
  //     console.error("Error downloading data:", err);
  //     toast.error("Failed to download data. Please try again.");
  //   }
  // };

  // Filter data based on search term
  const filterData = (data: LocalLoadedTTData[]) => {
    if (!searchTerm.trim()) return data;

    const searchLower = searchTerm.toLowerCase();
    return data.filter(item => {
      const searchableFields = [
        item.location_name,
        item.sap_id,
        item.total_loaded_qty?.toString(),
        formatBoolean(item.local_loading_repeated),
        formatBoolean(item.particular_product),
        formatBoolean(item.particular_time_of_day),
        typeof item.assigned_at_particular_bay === 'boolean' 
          ? formatBoolean(item.assigned_at_particular_bay)
          : item.assigned_at_particular_bay 
            ? formatNestedObject(item.assigned_at_particular_bay)
            : '',
        item.indent_request_details && Array.isArray(item.indent_request_details)
          ? item.indent_request_details.map((detail: IndentRequestDetail) => 
              `${detail.truck_number || ''} ${detail.date || ''} ${detail.user_id || ''} ${detail.vendor_name || ''}`
            ).join(' ')
          : ''
      ].filter(Boolean);

      return searchableFields.some(field =>
        field.toString().toLowerCase().includes(searchLower)
      );
    });
  };

  const filteredData = filterData(data);

  return (
    <div className="w-full">
      {/* Search Bar */}
      <div className="mt-4 mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 mt-1 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search..."
            disabled={isLoading}
            className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-gray-500 focus:border-gray-500 text-sm bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          {searchTerm && !isLoading && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center hover:bg-gray-100 rounded-r-lg transition-colors"
            >
              <XCircle className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
        {/* Download Button - Commented Out */}
        {/* <button
          onClick={handleDownload}
          disabled={isLoading || data.length === 0}
          className="p-1.5 bg-white rounded-lg shadow-lg hover:bg-gray-100 transition-colors border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Download data as Excel"
        >
          <Download size={20} className="text-gray-700" />
        </button> */}
      </div>

      {/* Error State */}
      {error && !isLoading && (
        <div className="text-center py-8">
          <p className="text-red-600 text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Table */}
      {!error && (
        <div className="rounded-xl border border-blue-200 overflow-hidden shadow-lg bg-white">
          <div className="overflow-x-auto overflow-y-auto max-h-[500px] relative">
            <table className="w-full min-w-[900px] border-collapse">
              <thead className="sticky top-0 z-10 shadow-sm">
                <tr className="bg-[#1e88e5]">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider first:pl-6 last:pr-6">
                    Location Name
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                    SAP ID
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                    Total Loaded Qty
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider min-w-[10rem] max-w-[10rem] whitespace-normal leading-tight">
                    Local Loading Repeated
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                    Particular Product
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider min-w-[10rem] max-w-[10rem] whitespace-normal leading-tight">
                    Particular Time of Day
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider min-w-[10rem] max-w-[10rem] whitespace-normal leading-tight">
                    Assigned at Particular Bay
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider min-w-[10rem] max-w-[10rem] whitespace-normal leading-tight">
                    Particular RO
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center bg-slate-50/30">
                      <div className="flex items-center justify-center gap-2 text-[#1e88e5]">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-slate-600 font-medium">Loading Local Loaded TT data...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredData.length > 0 ? (
                  filteredData.map((item, index) => {
                    const bayData = typeof item.assigned_at_particular_bay === 'object' && item.assigned_at_particular_bay !== null
                      ? item.assigned_at_particular_bay
                      : null;
                    const truckNumber = bayData?.truck_number || null;
                    const isExpanded = expandedRowIndex === index;

                    return (
                      <React.Fragment key={index}>
                        <tr className="bg-white hover:bg-blue-50/50 transition-colors group">
                          <td className="px-5 py-3.5 text-sm text-slate-700 whitespace-nowrap first:pl-6 font-medium">
                            {item.location_name || '-'}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                            {item.sap_id || '-'}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                            {item.total_loaded_qty && item.breakdown ? (
                              <button
                                onClick={() => handleTotalLoadedQtyClick(item)}
                                className="hover:underline font-medium cursor-pointer text-[#1e88e5] hover:text-[#1565c0]"
                              >
                                {item.total_loaded_qty.toLocaleString()}
                              </button>
                            ) : (
                              item.total_loaded_qty?.toLocaleString() || '-'
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                            {item.local_loading_repeated && item.local_loading_repeated_details && item.local_loading_repeated_details.length > 0 ? (
                              <button
                                onClick={() => handleLocalLoadingRepeatedClick(item)}
                                className="hover:underline font-medium cursor-pointer text-[#1e88e5] hover:text-[#1565c0]"
                              >
                                {formatBoolean(item.local_loading_repeated)}
                              </button>
                            ) : (
                              formatBoolean(item.local_loading_repeated)
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                            {formatBoolean(item.particular_product)}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                            {item.particular_time_of_day && item.particular_time_of_day_details && item.particular_time_of_day_details.length > 0 ? (
                              <button
                                onClick={() => handleParticularTimeOfDayClick(item)}
                                className="hover:underline font-medium cursor-pointer text-[#1e88e5] hover:text-[#1565c0]"
                              >
                                {formatBoolean(item.particular_time_of_day)}
                              </button>
                            ) : (
                              formatBoolean(item.particular_time_of_day)
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                            {item.assigned_at_particular_bay_details && item.assigned_at_particular_bay_details.length > 0 ? (
                              <button
                                onClick={() => handleAssignedAtParticularBayClick(item)}
                                className="hover:underline font-medium cursor-pointer text-[#1e88e5] hover:text-[#1565c0]"
                              >
                                {formatBoolean(true)}
                              </button>
                            ) : typeof item.assigned_at_particular_bay === 'boolean' 
                              ? formatBoolean(item.assigned_at_particular_bay)
                              : truckNumber ? (
                                <button
                                  onClick={() => handleTruckNumberClick(index)}
                                  className="hover:underline font-medium cursor-pointer text-[#1e88e5] hover:text-[#1565c0]"
                                >
                                  {truckNumber}
                                </button>
                              ) : '-'}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-600 whitespace-nowrap last:pr-6">
                            {item.indent_request_details && Array.isArray(item.indent_request_details) && item.indent_request_details.length > 0 ? (
                              <button
                                onClick={() => handleIndentRequestDetailsClick(item)}
                                className="hover:underline font-medium cursor-pointer text-[#1e88e5] hover:text-[#1565c0]"
                              >
                                {item.indent_request_details.length}
                              </button>
                            ) : '-'}
                          </td>
                        </tr>
                        {isExpanded && bayData && (
                          <tr>
                            <td colSpan={8} className="px-5 py-4 bg-slate-50/80">
                              <div className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-sm">
                                <table className="w-full border-collapse">
                                  <thead>
                                    <tr className="bg-slate-100">
                                      <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200">Truck Number</th>
                                      <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200">Assigned Bay</th>
                                      <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200">Reassigned Bay</th>
                                      <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200">Reassign Loaded Qty</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr className="hover:bg-slate-50/50">
                                      <td className="px-5 py-3 text-sm text-slate-700">{bayData.truck_number || '-'}</td>
                                      <td className="px-5 py-3 text-sm text-slate-700">{bayData.assigned_bay || '-'}</td>
                                      <td className="px-5 py-3 text-sm text-slate-700">{bayData.reassigned_bay || '-'}</td>
                                      <td className="px-5 py-3 text-sm text-slate-700">{bayData.reassign_loaded_qty?.toLocaleString() || '-'}</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center bg-slate-50/50">
                      <p className="text-slate-600 font-medium">
                        {data.length > 0 ? 'No data found matching your search' : 'No data available'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Breakdown Dialog */}
      <Dialog open={isBreakdownDialogOpen} onOpenChange={setIsBreakdownDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader className="pb-4 border-b border-slate-200">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-gray-900">
              <div className="p-2 rounded-lg" style={{ backgroundColor: '#1e88e520' }}>
                <AlertCircle className="h-5 w-5" style={{ color: '#1e88e5' }} />
              </div>
              Breakdown Details
            </DialogTitle>
            {selectedItemInfo && (
              <DialogDescription className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Location</p>
                    <p className="text-sm font-medium text-slate-900">{selectedItemInfo.location_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">SAP ID</p>
                    <p className="text-sm font-medium text-slate-900">{selectedItemInfo.sap_id || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Total Loaded Qty</p>
                    <p className="text-sm font-medium text-[#1e88e5]">{selectedItemInfo.total_loaded_qty?.toLocaleString() || '-'}</p>
                  </div>
                </div>
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="mt-6">
            {selectedBreakdown ? (
              <div className="rounded-xl border border-blue-200 overflow-hidden bg-white shadow-sm">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[#1e88e5]">
                      <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider first:rounded-tl-xl">Type</th>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider last:rounded-tr-xl">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5 text-sm font-medium text-slate-800">DG</td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{selectedBreakdown.dg?.toLocaleString() || 0}</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5 text-sm font-medium text-slate-800">Tank Truck</td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{selectedBreakdown.tank_truck?.toLocaleString() || 0}</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5 text-sm font-medium text-slate-800">Prover</td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{selectedBreakdown.prover?.toLocaleString() || 0}</td>
                    </tr>
                    <tr className="bg-blue-50/50 hover:bg-blue-50 transition-colors border-t border-slate-200">
                      <td className="px-5 py-3.5 text-sm font-bold text-slate-900">Total</td>
                      <td className="px-5 py-3.5 text-sm font-bold text-[#1e88e5]">
                        {((selectedBreakdown.dg || 0) + (selectedBreakdown.tank_truck || 0) + (selectedBreakdown.prover || 0)).toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-100">
                <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 font-medium">No breakdown data available</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Details Dialog - Reusable for both Local Loading Repeated and Particular Time of Day */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader className="pb-4 border-b border-slate-200">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-gray-900">
              <div className="p-2 rounded-lg" style={{ backgroundColor: '#1e88e520' }}>
                <AlertCircle className="h-5 w-5" style={{ color: '#1e88e5' }} />
              </div>
              {selectedDetails?.title || 'Details'}
            </DialogTitle>
            {selectedDetails && (
              <DialogDescription className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Location</p>
                    <p className="text-sm font-medium text-slate-900">{selectedDetails.location_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">SAP ID</p>
                    <p className="text-sm font-medium text-slate-900">{selectedDetails.sap_id || '-'}</p>
                  </div>
                </div>
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="mt-6">
            {selectedDetails?.details && selectedDetails.details.length > 0 ? (
              <div className="rounded-xl border border-blue-200 overflow-hidden bg-white shadow-sm">
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-10 shadow-sm">
                      <tr className="bg-[#1e88e5]">
                        {selectedDetails.type === 'local_loading_repeated' ? (
                          <>
                            <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">Date with Time</th>
                            <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">Truck Number</th>
                            <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">Loaded Qty</th>
                            <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">Bay Number</th>
                            <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">Count</th>
                          </>
                        ) : (
                          <>
                            <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">Truck Number</th>
                            <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">Date with Time</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {selectedDetails.type === 'local_loading_repeated' ? (
                        (selectedDetails.details as LocalLoadingRepeatedDetail[]).map((detail, index) => (
                          <tr key={index} className="hover:bg-slate-50/50 transition-colors even:bg-slate-50/30">
                            <td className="px-5 py-3.5 text-sm text-slate-700 whitespace-nowrap">{detail.date_with_time || detail.date || '-'}</td>
                            <td className="px-5 py-3.5 text-sm text-slate-700 whitespace-nowrap font-medium">{detail.truck_number || '-'}</td>
                            <td className="px-5 py-3.5 text-sm text-slate-700 whitespace-nowrap">{detail.loaded_qty != null ? detail.loaded_qty : '-'}</td>
                            <td className="px-5 py-3.5 text-sm text-slate-700 whitespace-nowrap">{detail.bay_number || '-'}</td>
                            <td className="px-5 py-3.5 text-sm text-slate-700 whitespace-nowrap">{detail.count != null ? detail.count : '-'}</td>
                          </tr>
                        ))
                      ) : (
                        (selectedDetails.details as ParticularTimeOfDayDetail[]).map((detail, index) => (
                          <tr key={index} className="hover:bg-slate-50/50 transition-colors even:bg-slate-50/30">
                            <td className="px-5 py-3.5 text-sm text-slate-700 whitespace-nowrap font-medium">{detail.truck_number || '-'}</td>
                            <td className="px-5 py-3.5 text-sm text-slate-700 whitespace-nowrap">{detail.date_with_time || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-100">
                <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 font-medium">No details available</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Assigned at Particular Bay Details Dialog */}
      <Dialog open={isAssignedAtBayDialogOpen} onOpenChange={setIsAssignedAtBayDialogOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader className="pb-4 border-b border-slate-200">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-gray-900">
              <div className="p-2 rounded-lg" style={{ backgroundColor: '#1e88e520' }}>
                <AlertCircle className="h-5 w-5" style={{ color: '#1e88e5' }} />
              </div>
              Assigned at Particular Bay Details
            </DialogTitle>
            {selectedAssignedAtBayDetails && (
              <DialogDescription className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Location</p>
                    <p className="text-sm font-medium text-slate-900">{selectedAssignedAtBayDetails.location_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">SAP ID</p>
                    <p className="text-sm font-medium text-slate-900">{selectedAssignedAtBayDetails.sap_id || '-'}</p>
                  </div>
                </div>
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="mt-6">
            {selectedAssignedAtBayDetails?.details && selectedAssignedAtBayDetails.details.length > 0 ? (
              <div className="rounded-xl border border-blue-200 overflow-hidden bg-white shadow-sm">
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-10 shadow-sm">
                      <tr className="bg-[#1e88e5]">
                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">Truck Number</th>
                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">Bay Number</th>
                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">BCU Number</th>
                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {selectedAssignedAtBayDetails.details.map((detail, index) => (
                        <tr key={index} className="hover:bg-slate-50/50 transition-colors even:bg-slate-50/30">
                          <td className="px-5 py-3.5 text-sm text-slate-700 whitespace-nowrap font-medium">{detail.truck_number || '-'}</td>
                          <td className="px-5 py-3.5 text-sm text-slate-700 whitespace-nowrap">{detail.bay_number || '-'}</td>
                          <td className="px-5 py-3.5 text-sm text-slate-700 whitespace-nowrap">{detail.bcu_number || '-'}</td>
                          <td className="px-5 py-3.5 text-sm text-slate-700 whitespace-nowrap">{detail.date || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-100">
                <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 font-medium">No details available</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Indent Request Details Dialog */}
      <Dialog open={isIndentRequestDialogOpen} onOpenChange={setIsIndentRequestDialogOpen}>
        <DialogContent className="sm:max-w-[900px]">
          <DialogHeader className="pb-4 border-b border-slate-200">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-gray-900">
              <div className="p-2 rounded-lg" style={{ backgroundColor: '#1e88e520' }}>
                <AlertCircle className="h-5 w-5" style={{ color: '#1e88e5' }} />
              </div>
              Indent Request Details
            </DialogTitle>
            {selectedIndentRequestDetails && (
              <DialogDescription className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Location</p>
                    <p className="text-sm font-medium text-slate-900">{selectedIndentRequestDetails.location_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">SAP ID</p>
                    <p className="text-sm font-medium text-slate-900">{selectedIndentRequestDetails.sap_id || '-'}</p>
                  </div>
                </div>
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="mt-6">
            {selectedIndentRequestDetails?.details && selectedIndentRequestDetails.details.length > 0 ? (
              <div className="rounded-xl border border-blue-200 overflow-hidden bg-white shadow-sm">
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-10 shadow-sm">
                      <tr className="bg-[#1e88e5]">
                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">Truck Number</th>
                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">Date</th>
                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">User ID</th>
                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">Vendor Name</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {selectedIndentRequestDetails.details.map((detail, index) => (
                        <tr key={index} className="hover:bg-slate-50/50 transition-colors even:bg-slate-50/30">
                          <td className="px-5 py-3.5 text-sm text-slate-700 whitespace-nowrap font-medium">{detail.truck_number || '-'}</td>
                          <td className="px-5 py-3.5 text-sm text-slate-700 whitespace-nowrap">{detail.date || '-'}</td>
                          <td className="px-5 py-3.5 text-sm text-slate-700 whitespace-nowrap">{detail.user_id || '-'}</td>
                          <td className="px-5 py-3.5 text-sm text-slate-700 whitespace-nowrap">{detail.vendor_name || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-100">
                <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 font-medium">No indent request details available</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LocalLoadedTT;
