import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Info, Download, RefreshCw, Check } from 'lucide-react';
import { apiClient } from "@/services/apiClient";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

interface AlertData {
  zone: string;
  location: string;
  alerts: number;
}

interface CriticalAlertsTableProps {
  onCriticalAlertDetails?: (location: string, severity: string[]) => void;
  startDate?: string;
  endDate?: string;
  refreshTrigger?: number;
}

const CriticalAlertsTable: React.FC<CriticalAlertsTableProps> = ({ onCriticalAlertDetails, startDate, endDate, refreshTrigger = 0 }) => {
  const [alertData, setAlertData] = useState<AlertData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const SEVERITY_OPTIONS = [
    { id: 'Critical' as const, letter: 'C', color: '#dc2626' },
    { id: 'High' as const, letter: 'H', color: '#ea580c' },
    { id: 'Medium' as const, letter: 'M', color: '#ca8a04' },
    { id: 'Low' as const, letter: 'L', color: '#16a34a' },
  ];
  const [selectedSeverityOptions, setSelectedSeverityOptions] = useState<string[]>(['Critical', 'High', 'Medium', 'Low']);
  const alertSeverity = useMemo(
    () => (selectedSeverityOptions.length === 4 ? [''] : selectedSeverityOptions),
    [selectedSeverityOptions]
  );
  const [isDownloading, setIsDownloading] = useState(false);

  const handleLocationClick = (location: string) => {
    setSelectedLocation(location);
  };

  const handleLocationDetailsClick = (location: string) => {
    onCriticalAlertDetails?.(location, alertSeverity);
    // Smooth scroll to the details table after a brief delay
    setTimeout(() => {
      const detailsTable = document.querySelector('[data-details-table]');
      if (detailsTable) {
        detailsTable.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    }, 100);
  };

  useEffect(() => {
    const fetchCriticalAlerts = async () => {
      try {
        setIsLoading(true);
        const payload = {
          "analytical_model": "Location Alert Critical",
          "zone": "",
          "location_name": "",
          "alert_severity": alertSeverity,
          "alert_status": "Open",
          "start_date": startDate || new Date().toISOString().split('T')[0],
          "end_date": endDate || new Date().toISOString().split('T')[0],
          // "top_n": 10
        };

        const response = await apiClient.post('/api/tasanalytics/tas_analytics', payload);

        if (response && response.data) {
          // Normalise API response: support { data: [...] } or { data: { data: [...] } } or direct array
          let apiData: any = response.data;
          if (apiData && typeof apiData === 'object') {
            if (Array.isArray(apiData.data)) {
              apiData = apiData.data;
            } else if (apiData.data && Array.isArray(apiData.data.data)) {
              apiData = apiData.data.data;
            }
          }
          const rawArray = Array.isArray(apiData) ? apiData : [];
          let transformedData: AlertData[] = rawArray.map((item: any) => ({
            zone: item.zone || '',
            location: item.location_name || item.location || '',
            alerts: item.total_alerts || item.count || item.critical_count || item.alert_count || item.alerts || 0
          }));

          // Show only top 10 by alert count (descending)
          const top10 = [...transformedData]
            .sort((a, b) => b.alerts - a.alerts)
            .slice(0, 10);
          setAlertData(top10);
        }
      } catch (err) {
        console.error('Error fetching critical alerts:', err);
        setError('Failed to load critical alerts data');
        setAlertData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCriticalAlerts();
  }, [selectedLocation, startDate, endDate, refreshTrigger, alertSeverity]);

  // Calculate width percentage based on alert count
  const getWidthPercentage = (count: number) => {
    const maxAlerts = Math.max(...alertData.map(item => item.alerts), 1);
    return (count / maxAlerts) * 100;
  };

  // Handle severity toggle (C/H/M/L)
  const toggleSeverity = (severity: string) => {
    setSelectedSeverityOptions(prev => {
      let next: string[];
      if (prev.includes(severity)) {
        next = prev.filter((s) => s !== severity);
        if (next.length === 0) next = ['Critical'];
      } else {
        next = [...prev, severity];
      }
      return next;
    });
  };

  const handleDownload = async () => {
    try {
      setIsDownloading(true);

      const payload = {
        "analytical_model": "Location Alert Critical",
        "zone": "",
        "location_name": "",
        "alert_status": "Open",
        "alert_severity": [],
        "start_date": startDate || new Date().toISOString().split('T')[0],
        "end_date": endDate || new Date().toISOString().split('T')[0],
        "download": "true"
      };

      const response = await apiClient.post('/api/tasanalytics/tas_analytics', payload);

      if (response && response.data) {
        let dataArray: any[] = [];
        const resData = response.data;

        // Handle different response types
        if (resData instanceof Blob) {
          // If it's a blob, check if it's already an Excel file
          if (resData.type && (
            resData.type.includes('spreadsheet') || 
            resData.type.includes('excel') ||
            resData.type === 'application/octet-stream'
          )) {
            // It's already an Excel file, use it directly
            const startDateStr = startDate || new Date().toISOString().split('T')[0];
            const endDateStr = endDate || new Date().toISOString().split('T')[0];
            const filename = `Critical_Alerts_${startDateStr}_to_${endDateStr}.xlsx`;
            saveAs(resData, filename);
            return;
          } else {
            // Blob contains JSON, parse it
            const text = await resData.text();
            try {
              const jsonData = JSON.parse(text);
              if (Array.isArray(jsonData)) {
                dataArray = jsonData;
              } else if (typeof jsonData === 'object' && jsonData !== null) {
                dataArray = Object.values(jsonData);
              }
            } catch (e) {
              console.error('Error parsing blob as JSON:', e);
              return;
            }
          }
        } else if (Array.isArray(resData)) {
          dataArray = resData;
        } else if (typeof resData === 'object' && resData !== null) {
          // Normalise: { data: [...] } or { data: { data: [...] } }
          if (Array.isArray(resData.data)) {
            dataArray = resData.data;
          } else if (resData.data && Array.isArray(resData.data.data)) {
            dataArray = resData.data.data;
          } else {
            dataArray = Object.values(resData);
          }
        }

        // Ensure we have data to export
        if (dataArray.length === 0) {
          console.warn('No data to export');
          return;
        }

        // Flatten the data structure for Excel with all alert details
        const flattenedData = dataArray.map((item: any) => ({
          'Unique ID': item.unique_id || '',
          'Zone': item.zone || '',
          'Location Name': item.location_name || item.location || '',
          'Interlock Name': item.interlock_name || '',
          'Severity': item.severity || '',
          'Alert Status': item.alert_status || '',
          'Ageing Days': item.ageing_days || 0,
          'Created At': item.created_at || '',
        }));

        // Create Excel workbook
        const ws = XLSX.utils.json_to_sheet(flattenedData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Critical Alerts');

        // Generate Excel file - use 'array' type for proper Excel format
        const excelBuffer = XLSX.write(wb, { 
          bookType: 'xlsx', 
          type: 'array'
        });
        
        // Create blob with correct MIME type
        const blob = new Blob([excelBuffer], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });

        const startDateStr = startDate || new Date().toISOString().split('T')[0];
        const endDateStr = endDate || new Date().toISOString().split('T')[0];
        const filename = `Critical_Alerts_${startDateStr}_to_${endDateStr}.xlsx`;

        saveAs(blob, filename);
      }
    } catch (err) {
      console.error('Error downloading data:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full px-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Top 10 Locations Open Alerts</h3>
        <div className="flex items-center justify-center py-4">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Loading critical alerts data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full px-4">
        <h3 className="text-sm font-semibold text-gray-950 mb-2">Top 10 Locations Open Alerts</h3>
        <div className="flex items-center justify-center py-4">
          <div className="text-red-500 text-sm">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col px-1 pb-2 overflow-hidden">
      {/* Top 5 Locations Heading */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <h3 className="text-sm font-semibold text-black">Top 10 Locations Open Alerts</h3>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="p-1.5 text-blue-600 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Download for all locations"
          >
            {isDownloading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </button>
          {/* <label className="text-xs font-medium text-gray-700">Alert Severity:</label> */}
          {SEVERITY_OPTIONS.map((opt) => {
            const isSelected = selectedSeverityOptions.includes(opt.id);
            return (
              <div key={opt.id} className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-medium text-gray-700">{opt.letter}</span>
                <button
                  type="button"
                  onClick={() => toggleSeverity(opt.id)}
                  className="flex h-5 w-5 items-center justify-center rounded-sm shrink-0 border-2 bg-transparent p-0 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400"
                  style={{ borderColor: opt.color }}
                  aria-pressed={isSelected}
                  title={opt.id}
                >
                  {isSelected ? <Check className="h-3 w-3" strokeWidth={5.5} style={{ color: '#2563eb' }} /> : null}
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-0 text-[10px] ml-1 text-gray-500 leading-none mb-1 flex-shrink-0">
        <Info className="h-3 w-3" />
        <span>Click on location name to get details in table</span>
      </div>

      {/* Selected Location Indicator */}
      {selectedLocation && (
        <div className="mb-0.5 p-1.5 bg-blue-50 border border-blue-200 rounded text-xs flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-blue-800">
              <strong>Filtered by:</strong> {selectedLocation}
            </span>
            <button
              onClick={() => setSelectedLocation("")}
              className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-gray-200 bg-white">
              <th className="text-center py-2 px-2 font-medium text-[12px] text-black w-12">
                SL.NO
              </th>
              <th className="text-left py-2 px-2 font-medium text-[12px] text-black w-16">
                ZONE
              </th>
              <th className="text-left py-2 px-2 font-medium text-[12px] text-black">
                LOCATION
              </th>
              <th className="text-right py-2 px-2 font-medium text-[12px] text-black">
                COUNT
              </th>
            </tr>
          </thead>
          <tbody>
            {alertData.map((row, index) => (
              <tr key={index} className="border-b border-gray-100">
                <td className="py-2 px-2 text-center text-[11px] text-black w-12">
                  {index + 1}
                </td>
                <td className="py-2 px-2 text-[11px] text-black w-16">
                  {row.zone}
                </td>
                <td className="py-2 px-2">
                  <div className="flex flex-col">
                    <button
                      onClick={() => handleLocationDetailsClick(row.location)}
                      className={`text-left font-medium text-blue-600 transition-colors cursor-pointer text-[11px] hover:underline ${
                        selectedLocation === row.location ? 'text-blue-600 font-semibold' : ''
                      }`}
                      title="View Details"
                    >
                      {row.location}
                    </button>
                    <div className="mt-1.5 relative w-full bg-gray-200 rounded-full" style={{ height: '8px' }}>
                      <div
                        className="rounded-full h-full"
                        style={{ 
                          width: `${getWidthPercentage(row.alerts)}%`,
                          background: 'linear-gradient(to right, #3B82F6, #3B82F6, #3B82F6)'
                        }}
                      />
                    </div>
                  </div>
                </td>
                <td className="py-2 px-2 text-right">
                  <span className="font-semibold text-[11px] text-gray-700">{row.alerts}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CriticalAlertsTable;