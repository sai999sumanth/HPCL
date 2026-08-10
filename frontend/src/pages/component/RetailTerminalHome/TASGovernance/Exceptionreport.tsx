import React, { useState, useEffect, useMemo } from 'react';
import { Download, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import LocationDetailDialog from './LocationDetailDialog';

interface ExceptionReportProps {
  startDate?: string;
  endDate?: string;
  refreshTrigger?: number;
}

export default function ExceptionReport({ startDate, endDate, refreshTrigger = 0 }: ExceptionReportProps = {}) {
  const [data, setData] = useState([]);
  const [rawData, setRawData] = useState<any[]>([]); // Store raw data with _detail fields
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedLocationData, setSelectedLocationData] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, refreshTrigger]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = {
        analytical_model: "Tas Alerts Exception Report",
        location_name: "",
        interlock_name: "",
        alert_status: "",
        alert_severity: [],
        zone: "",
        start_date: startDate || new Date().toISOString().split('T')[0],
        end_date: endDate || new Date().toISOString().split('T')[0],
        equipment_type: "",
        equipment_name: "",
        download: "",
        top_n: 0
      };

      const response = await apiClient.post('/api/tasanalytics/tas_analytics', payload, {
        timeout: 0
      });

      if (response && response.data) {
        const apiData = response.data;
        let processedData = [];
        let rawDataArray: any[] = [];

        if (Array.isArray(apiData)) {
          // Store raw data with all fields including _detail
          rawDataArray = apiData;
          // If array, process each object
          processedData = apiData.map((item: any) => {
            if (typeof item === 'object' && item !== null) {
              // Filter out keys ending with "_detail" and metadata key "0"
              const filteredItem: any = {};
              Object.keys(item).forEach(key => {
                if (!key.endsWith('_detail') && key !== '0') {
                  filteredItem[key] = item[key];
                }
              });
              return filteredItem;
            }
            return item;
          });
        } else if (typeof apiData === 'object' && apiData !== null) {
          // Store raw data
          rawDataArray = [apiData];
          // If single object, filter out unwanted keys
          const filteredItem: any = {};
          Object.keys(apiData).forEach(key => {
            if (!key.endsWith('_detail') && key !== '0') {
              filteredItem[key] = apiData[key];
            }
          });
          processedData = [filteredItem];
        } else {
          processedData = apiData;
          rawDataArray = Array.isArray(apiData) ? apiData : [apiData];
        }

        setData(processedData);
        setRawData(rawDataArray);
      }
    } catch (err) {
      setError(err.message);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle column sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Handle location click
  const handleLocationClick = (location: string, rowIndex: number) => {
    if (location) {
      console.log('Location clicked:', location);
      console.log('Raw data length:', rawData.length);
      
      // Find the location data from raw data (with _detail fields)
      const locationData = rawData.find((item: any) => item.Location === location);
      
      console.log('Found location data:', locationData);
      
      if (locationData) {
        setSelectedLocation(location);
        setSelectedLocationData(locationData);
        setIsDialogOpen(true);
      } else {
        console.warn('Location data not found for:', location);
        // Try to find by index as fallback
        if (rawData[rowIndex]) {
          setSelectedLocation(location);
          setSelectedLocationData(rawData[rowIndex]);
          setIsDialogOpen(true);
        }
      }
    }
  };

  // Sort data based on current sort column and direction
  const sortedData = useMemo(() => {
    if (!sortColumn || data.length === 0) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // Try to parse as number
      const aNum = parseFloat(String(aValue));
      const bNum = parseFloat(String(bValue));
      const isNumeric = !isNaN(aNum) && !isNaN(bNum);

      if (isNumeric) {
        // Numeric comparison
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      } else {
        // String comparison
        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();
        if (sortDirection === 'asc') {
          return aStr.localeCompare(bStr);
        } else {
          return bStr.localeCompare(aStr);
        }
      }
    });
  }, [data, sortColumn, sortDirection]);

  const handleDownload = async () => {
    try {
      const payload = {
        analytical_model: "Tas Alerts Exception Report",
        location_name: "",
        interlock_name: "",
        alert_status: "",
        alert_severity: [],
        zone: "",
        start_date: startDate || new Date().toISOString().split('T')[0],
        end_date: endDate || new Date().toISOString().split('T')[0],
        equipment_type: "",
        equipment_name: "",
        download: "True",
        top_n: 0
      };

      const response = await apiClient.post('/api/tasanalytics/tas_analytics', payload, {
        responseType: 'blob',
        timeout: 0
      });

      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `exception_report_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-900">
           Exception Report(SOP Deviation)
        </h4>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 transition text-xs"
        >
          <Download size={16} />
          Download Excel
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-auto max-h-96">
          {data.length === 0 ? (
            <div className="text-center py-8 text-gray-600 text-sm">No data available</div>
          ) : (
            <table className="min-w-full bg-white text-xs">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  {Object.keys(data[0]).map((key) => (
                    <th
                      key={key}
                      onClick={() => handleSort(key)}
                      className="px-2 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b border-gray-200 bg-gray-100 cursor-pointer hover:bg-gray-200 select-none transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>{key.replace(/_/g, ' ')}</span>
                        <div className="flex flex-col items-center justify-center">
                          {sortColumn === key ? (
                            sortDirection === 'asc' ? (
                              <ChevronUp className="h-4 w-4 text-blue-600 font-bold" strokeWidth={3} />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-blue-600 font-bold" strokeWidth={3} />
                            )
                          ) : (
                            <div className="flex flex-col items-center justify-center opacity-40">
                              <ChevronUp className="h-3 w-3 -mb-0.5" />
                              <ChevronDown className="h-3 w-3" />
                            </div>
                          )}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    {Object.keys(data[0] || {}).map((key, i) => {
                      const val = row[key];
                      const isLocation = key === 'Location';
                      return (
                        <td 
                          key={i} 
                          onClick={() => isLocation && handleLocationClick(val, idx)}
                          className={`px-2 py-2 whitespace-nowrap text-xs ${
                            isLocation ? 'text-blue-600 cursor-pointer hover:text-blue-700 hover:underline' : 'text-gray-900'
                          }`}
                        >
                        {val ? String(val) : '0'}
                      </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <LocationDetailDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        location={selectedLocation}
        locationData={selectedLocationData}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  );
}