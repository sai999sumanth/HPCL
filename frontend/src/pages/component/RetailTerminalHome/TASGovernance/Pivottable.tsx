import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Minus, Loader2, ChevronUp, ChevronDown, Download } from 'lucide-react';
import { apiClient } from "@/services/apiClient";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

interface Interlock {
  interlock_name: string;
  severity: string;
  count: number;
}

interface LocationData {
  zone: string;
  location_name: string;
  total_alerts: number;
  open_alerts?: number;
  closed_alerts?: number;
  interlocks: Interlock[];
}

interface ExpandedState {
  [key: string]: boolean;
}

interface NestedPivotTableProps {
  startDate?: string;
  endDate?: string;
  refreshTrigger?: number;
  selectedSeverity?: string[];
}

export interface NestedPivotTableRef {
  handleDownload: () => Promise<void>;
}

const NestedPivotTable = React.forwardRef<NestedPivotTableRef, NestedPivotTableProps>(
  ({ startDate, endDate, refreshTrigger = 0, selectedSeverity = ['Critical'] }, ref) => {
  const [data, setData] = useState<LocationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLocations, setExpandedLocations] = useState<ExpandedState>({});
  const [interlockSortDirection, setInterlockSortDirection] = useState<'asc' | 'desc' | null>('asc');
  const [severitySortDirection, setSeveritySortDirection] = useState<'asc' | 'desc' | null>(null);
  type MainSortField = 'zone' | 'location_name' | 'total_alerts' | 'open_alerts' | 'closed_alerts';
  const [mainSortField, setMainSortField] = useState<MainSortField>('total_alerts');
  const [mainSortDirection, setMainSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isDownloading, setIsDownloading] = useState(false);
  const fetchInFlightRef = useRef(false);
  const lastFetchDepsRef = useRef<string>('');

  const severityKey = useMemo(
    () => JSON.stringify(Array.isArray(selectedSeverity) ? [...selectedSeverity].sort() : selectedSeverity),
    [selectedSeverity]
  );

  useEffect(() => {
    const depsKey = `${startDate ?? ''}-${endDate ?? ''}-${refreshTrigger}-${severityKey}`;
    if (fetchInFlightRef.current) return;
    if (lastFetchDepsRef.current === depsKey) return;
    lastFetchDepsRef.current = depsKey;
    fetchInFlightRef.current = true;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const basePayload = {
          analytical_model: "Location Alert Critical",
          zone: "",
          location_name: "",
          alert_severity: selectedSeverity,
          start_date: startDate || new Date().toISOString().split('T')[0],
          end_date: endDate || new Date().toISOString().split('T')[0],
        };

        // Make three API calls for Total, Open, and Closed
        const [totalResponse, openResponse, closedResponse] = await Promise.all([
          apiClient.post('/api/tasanalytics/tas_analytics', {
            ...basePayload,
            alert_status: "",
          }),
          apiClient.post('/api/tasanalytics/tas_analytics', {
            ...basePayload,
            alert_status: "Open",
          }),
          apiClient.post('/api/tasanalytics/tas_analytics', {
            ...basePayload,
            alert_status: "Close",
          }),
        ]);

        // Normalize: API returns { status, message, data: [...] }
        const totalArray = Array.isArray(totalResponse.data?.data)
          ? totalResponse.data.data
          : Array.isArray(totalResponse.data)
            ? totalResponse.data
            : [];
        const openArray = Array.isArray(openResponse.data?.data)
          ? openResponse.data.data
          : Array.isArray(openResponse.data)
            ? openResponse.data
            : [];
        const closedArray = Array.isArray(closedResponse.data?.data)
          ? closedResponse.data.data
          : Array.isArray(closedResponse.data)
            ? closedResponse.data
            : [];

        if (totalArray.length > 0 || openArray.length > 0 || closedArray.length > 0) {
          // Create a map to merge data from all three responses
          const locationMap = new Map<string, LocationData>();

          // Process total alerts
          totalArray.forEach((location: LocationData) => {
            const key = `${location.zone}-${location.location_name}`;
            locationMap.set(key, {
              ...location,
              total_alerts: location.total_alerts || 0,
              open_alerts: 0,
              closed_alerts: 0,
            });
          });

          // Process open alerts
          if (openArray.length > 0) {
            openArray.forEach((location: LocationData) => {
              const key = `${location.zone}-${location.location_name}`;
              const existing = locationMap.get(key);
              if (existing) {
                existing.open_alerts = location.total_alerts || 0;
              } else {
                locationMap.set(key, {
                  ...location,
                  total_alerts: location.total_alerts || 0,
                  open_alerts: location.total_alerts || 0,
                  closed_alerts: 0,
                });
              }
            });
          }

          // Process closed alerts
          if (closedArray.length > 0) {
            closedArray.forEach((location: LocationData) => {
              const key = `${location.zone}-${location.location_name}`;
              const existing = locationMap.get(key);
              if (existing) {
                existing.closed_alerts = location.total_alerts || 0;
              } else {
                locationMap.set(key, {
                  ...location,
                  total_alerts: location.total_alerts || 0,
                  open_alerts: 0,
                  closed_alerts: location.total_alerts || 0,
                });
              }
            });
          }

          setData(Array.from(locationMap.values()));
        } else {
          setError('Invalid response format');
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data');
      } finally {
        setIsLoading(false);
        fetchInFlightRef.current = false;
      }
    };

    fetchData();
  }, [startDate, endDate, refreshTrigger, severityKey]);

  // When filter dropdown (selectedSeverity) changes, reset expand to default (all collapsed)
  useEffect(() => {
    setExpandedLocations({});
  }, [selectedSeverity]);

  const toggleLocation = (locationKey: string) => {
    setExpandedLocations(prev => ({ ...prev, [locationKey]: !prev[locationKey] }));
  };

  const handleInterlockSortByCount = () => {
    if (interlockSortDirection === 'asc') {
      setInterlockSortDirection('desc');
    } else if (interlockSortDirection === 'desc') {
      setInterlockSortDirection(null);
    } else {
      setInterlockSortDirection('asc');
    }
    setSeveritySortDirection(null);
  };

  const handleInterlockSortBySeverity = () => {
    if (severitySortDirection === 'asc') {
      setSeveritySortDirection('desc');
    } else if (severitySortDirection === 'desc') {
      setSeveritySortDirection(null);
    } else {
      setSeveritySortDirection('asc');
    }
    setInterlockSortDirection(null);
  };

  // Sort main table by selected column and direction
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      let cmp = 0;
      if (mainSortField === 'zone') {
        cmp = (a.zone || '').localeCompare(b.zone || '');
      } else if (mainSortField === 'location_name') {
        cmp = (a.location_name || '').localeCompare(b.location_name || '');
      } else if (mainSortField === 'total_alerts') {
        cmp = (a.total_alerts || 0) - (b.total_alerts || 0);
      } else if (mainSortField === 'open_alerts') {
        cmp = (a.open_alerts || 0) - (b.open_alerts || 0);
      } else if (mainSortField === 'closed_alerts') {
        cmp = (a.closed_alerts || 0) - (b.closed_alerts || 0);
      }
      return mainSortDirection === 'asc' ? cmp : -cmp;
    });
  }, [data, mainSortField, mainSortDirection]);

  const handleMainTableSort = (field: MainSortField) => {
    setMainSortField(field);
    setMainSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const handleDownload = React.useCallback(async () => {
    try {
      setIsDownloading(true);

      const basePayload = {
        analytical_model: "Location Alert Critical",
        zone: "",
        location_name: "",
        alert_severity: selectedSeverity,
        start_date: startDate || new Date().toISOString().split('T')[0],
        end_date: endDate || new Date().toISOString().split('T')[0],
      };

      // Make three API calls for Total, Open, and Closed
      const [totalResponse, openResponse, closedResponse] = await Promise.all([
        apiClient.post('/api/tasanalytics/tas_analytics', {
          ...basePayload,
          alert_status: "",
        }),
        apiClient.post('/api/tasanalytics/tas_analytics', {
          ...basePayload,
          alert_status: "Open",
        }),
        apiClient.post('/api/tasanalytics/tas_analytics', {
          ...basePayload,
          alert_status: "Close",
        }),
      ]);

      // Normalize: API returns { status, message, data: [...] }
      const totalArray = Array.isArray(totalResponse.data?.data)
        ? totalResponse.data.data
        : Array.isArray(totalResponse.data)
          ? totalResponse.data
          : [];
      const openArray = Array.isArray(openResponse.data?.data)
        ? openResponse.data.data
        : Array.isArray(openResponse.data)
          ? openResponse.data
          : [];
      const closedArray = Array.isArray(closedResponse.data?.data)
        ? closedResponse.data.data
        : Array.isArray(closedResponse.data)
          ? closedResponse.data
          : [];

      if (totalArray.length > 0 || openArray.length > 0 || closedArray.length > 0) {
        // Create a map to merge data from all three responses
        const locationMap = new Map<string, LocationData>();

        // Process total alerts
        totalArray.forEach((location: LocationData) => {
          const key = `${location.zone}-${location.location_name}`;
          locationMap.set(key, {
            ...location,
            total_alerts: location.total_alerts || 0,
            open_alerts: 0,
            closed_alerts: 0,
          });
        });

        // Process open alerts
        if (openArray.length > 0) {
          openArray.forEach((location: LocationData) => {
            const key = `${location.zone}-${location.location_name}`;
            const existing = locationMap.get(key);
            if (existing) {
              existing.open_alerts = location.total_alerts || 0;
            }
          });
        }

        // Process closed alerts
        if (closedArray.length > 0) {
          closedArray.forEach((location: LocationData) => {
            const key = `${location.zone}-${location.location_name}`;
            const existing = locationMap.get(key);
            if (existing) {
              existing.closed_alerts = location.total_alerts || 0;
            }
          });
        }

        // Flatten the nested data structure for Excel
        const flattenedData: any[] = [];
        
        Array.from(locationMap.values()).forEach((location: LocationData) => {
          if (location.interlocks && location.interlocks.length > 0) {
            location.interlocks.forEach((interlock: Interlock) => {
              flattenedData.push({
                'Zone': location.zone || '',
                'Location Name': location.location_name || '',
                'Total Alerts': location.total_alerts || 0,
                'Open Alerts': location.open_alerts || 0,
                'Closed Alerts': location.closed_alerts || 0,
                'Interlock Name': interlock.interlock_name || '',
                'Severity': interlock.severity || '',
                'Count': interlock.count || 0,
              });
            });
          } else {
            flattenedData.push({
              'Zone': location.zone || '',
              'Location Name': location.location_name || '',
              'Total Alerts': location.total_alerts || 0,
              'Open Alerts': location.open_alerts || 0,
              'Closed Alerts': location.closed_alerts || 0,
              'Interlock Name': '',
              'Severity': '',
              'Count': 0,
            });
          }
        });

        // Create workbook and worksheet
        const ws = XLSX.utils.json_to_sheet(flattenedData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Location Alerts');

        // Generate Excel file buffer
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        // Generate filename with date range
        const startDateStr = startDate || new Date().toISOString().split('T')[0];
        const endDateStr = endDate || new Date().toISOString().split('T')[0];
        const filename = `Location_Alerts_${startDateStr}_to_${endDateStr}.xlsx`;

        // Download the file
        saveAs(blob, filename);
      } else {
        console.error('Invalid response format for download');
      }
    } catch (err) {
      console.error('Error downloading data:', err);
    } finally {
      setIsDownloading(false);
    }
  }, [startDate, endDate, selectedSeverity]);

  // Expose download function via ref
  React.useImperativeHandle(ref, () => ({
    handleDownload,
  }));

  // Sort interlocks based on sort direction (count or severity)
  const getSortedInterlocks = React.useCallback((interlocks: Interlock[]) => {
    if (interlockSortDirection) {
      return [...interlocks].sort((a, b) => {
        if (interlockSortDirection === 'asc') {
          return a.count - b.count;
        } else {
          return b.count - a.count;
        }
      });
    }
    
    if (severitySortDirection) {
      return [...interlocks].sort((a, b) => {
        const severityA = (a.severity || '').toLowerCase();
        const severityB = (b.severity || '').toLowerCase();
        if (severitySortDirection === 'asc') {
          return severityA.localeCompare(severityB);
        } else {
          return severityB.localeCompare(severityA);
        }
      });
    }
    
    return interlocks;
  }, [interlockSortDirection, severitySortDirection]);

  if (isLoading) {
    return (
      <div className="w-full flex justify-center items-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Loading data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full flex justify-center items-center py-12">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="bg-white rounded-lg shadow border border-gray-300 min-h-full">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className="px-2 py-1.5 text-center text-xs text-gray-700 uppercase border-r border-gray-300 w-10">
              </th>
              <th className="px-2 py-1.5 text-center text-xs text-gray-700 uppercase border-r border-gray-300 w-12">
                RANK
              </th>
              <th
                className="px-2 py-1.5 text-left text-xs text-gray-700 uppercase border-r border-gray-300 cursor-pointer hover:bg-gray-200 select-none"
                onClick={() => handleMainTableSort('zone')}
              >
                <div className="flex items-center gap-1">
                  ZONE
                  {mainSortField === 'zone' ? (mainSortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5 inline shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 inline shrink-0" />) : (
                    <div className="flex flex-col leading-none opacity-50"><ChevronUp className="h-2.5 w-2.5 -mb-0.5" /><ChevronDown className="h-2.5 w-2.5" /></div>
                  )}
                </div>
              </th>
              <th
                className="px-2 py-1.5 text-left text-xs text-gray-700 uppercase border-r border-gray-300 cursor-pointer hover:bg-gray-200 select-none"
                onClick={() => handleMainTableSort('location_name')}
              >
                <div className="flex items-center gap-1">
                  LOCATION NAME
                  {mainSortField === 'location_name' ? (mainSortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5 inline shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 inline shrink-0" />) : (
                    <div className="flex flex-col leading-none opacity-50"><ChevronUp className="h-2.5 w-2.5 -mb-0.5" /><ChevronDown className="h-2.5 w-2.5" /></div>
                  )}
                </div>
              </th>
              <th
                className="px-2 py-1.5 text-center text-xs text-gray-700 uppercase border-r border-gray-300 cursor-pointer hover:bg-gray-200 select-none"
                onClick={() => handleMainTableSort('total_alerts')}
              >
                <div className="flex items-center justify-center gap-1">
                  TOTAL COUNT
                  {mainSortField === 'total_alerts' ? (mainSortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5 inline shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 inline shrink-0" />) : (
                    <div className="flex flex-col leading-none opacity-50"><ChevronUp className="h-2.5 w-2.5 -mb-0.5" /><ChevronDown className="h-2.5 w-2.5" /></div>
                  )}
                </div>
              </th>
              <th
                className="px-2 py-1.5 text-center text-xs text-gray-700 uppercase border-r border-gray-300 cursor-pointer hover:bg-gray-200 select-none"
                onClick={() => handleMainTableSort('open_alerts')}
              >
                <div className="flex items-center justify-center gap-1">
                  OPEN COUNT
                  {mainSortField === 'open_alerts' ? (mainSortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5 inline shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 inline shrink-0" />) : (
                    <div className="flex flex-col leading-none opacity-50"><ChevronUp className="h-2.5 w-2.5 -mb-0.5" /><ChevronDown className="h-2.5 w-2.5" /></div>
                  )}
                </div>
              </th>
              <th
                className="px-2 py-1.5 text-center text-xs text-gray-700 uppercase cursor-pointer hover:bg-gray-200 select-none"
                onClick={() => handleMainTableSort('closed_alerts')}
              >
                <div className="flex items-center justify-center gap-1">
                  CLOSED COUNT
                  {mainSortField === 'closed_alerts' ? (mainSortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5 inline shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 inline shrink-0" />) : (
                    <div className="flex flex-col leading-none opacity-50"><ChevronUp className="h-2.5 w-2.5 -mb-0.5" /><ChevronDown className="h-2.5 w-2.5" /></div>
                  )}
                </div>
              </th>
            </tr>
          </thead>

          <tbody>
            {sortedData.map((location, idx) => {
              const locationKey = `${location.zone}-${location.location_name}`;
              const isExpanded = expandedLocations[locationKey];
              const rank = idx + 1;

              return (
                <React.Fragment key={locationKey}>
                  {/* Main Location Row */}
                  <tr
                    className={`border-b border-gray-200 hover:bg-gray-50 ${
                      isExpanded ? 'bg-gray-50' : 'bg-white'
                    }`}
                  >
                    <td className="px-2 py-1.5 border-r border-gray-200 text-center cursor-pointer" onClick={() => toggleLocation(locationKey)}>
                      {isExpanded ? (
                        <Minus className="w-3 h-3 text-gray-600" />
                      ) : (
                        <Plus className="w-3 h-3 text-gray-600" />
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center text-xs text-gray-700 border-r border-gray-200 font-semibold">
                      {rank}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-gray-700 border-r border-gray-200">
                      {location.zone}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-gray-700 border-r border-gray-200">
                      {location.location_name}
                    </td>
                    <td className="px-2 py-1.5 text-center text-xs text-gray-700 border-r border-gray-200">
                      {(location.total_alerts || 0).toLocaleString()}
                    </td>
                    <td className="px-2 py-1.5 text-center text-xs text-gray-700 border-r border-gray-200">
                      {(location.open_alerts || 0).toLocaleString()}
                    </td>
                    <td className="px-2 py-1.5 text-center text-xs text-gray-700">
                      {(location.closed_alerts || 0).toLocaleString()}
                    </td>
                  </tr>

                  {/* Expanded Interlock Table */}
                  {isExpanded && (
                    <tr>
                      <td className="p-0"></td>
                      <td colSpan={6} className="p-0">
                        <div className="p-2">
                          <div className="max-h-32 overflow-y-auto border border-gray-300 rounded">
                            <table className="w-full">
                              <thead className="sticky top-0 bg-gray-50">
                                <tr className="border-b border-gray-300">
                                  <th className="px-2 py-1 text-left text-xs text-gray-700 uppercase border-r border-gray-300">
                                    INTERLOCK NAME
                                  </th>
                                  <th
                                    className="px-2 py-1 text-center text-xs text-gray-700 uppercase border-r border-gray-300 w-20 cursor-pointer hover:bg-gray-200 select-none"
                                    onClick={handleInterlockSortBySeverity}
                                  >
                                    <div className="flex items-center justify-center gap-1">
                                      SEVERITY
                                      {severitySortDirection === 'asc' && <ChevronUp className="h-3 w-3" />}
                                      {severitySortDirection === 'desc' && <ChevronDown className="h-3 w-3" />}
                                      {severitySortDirection === null && (
                                        <div className="flex flex-col">
                                          <ChevronUp className="h-2 w-2 -mb-1 opacity-50" />
                                          <ChevronDown className="h-2 w-2 opacity-50" />
                                        </div>
                                      )}
                                    </div>
                                  </th>
                                  <th
                                    className="px-2 py-1 text-center text-xs text-gray-700 uppercase w-24 cursor-pointer hover:bg-gray-200 select-none"
                                    onClick={handleInterlockSortByCount}
                                  >
                                    <div className="flex items-center justify-center gap-1">
                                      COUNT
                                      {interlockSortDirection === 'asc' && <ChevronUp className="h-3 w-3" />}
                                      {interlockSortDirection === 'desc' && <ChevronDown className="h-3 w-3" />}
                                      {interlockSortDirection === null && (
                                        <div className="flex flex-col">
                                          <ChevronUp className="h-2 w-2 -mb-1 opacity-50" />
                                          <ChevronDown className="h-2 w-2 opacity-50" />
                                        </div>
                                      )}
                                    </div>
                                  </th>
                                </tr>
                              </thead>

                              <tbody>
                                {getSortedInterlocks(location.interlocks)
                                  .map((interlock, intIdx) => (
                                    <tr
                                      key={`${locationKey}-${intIdx}`}
                                      className="border-b border-gray-200 bg-white hover:bg-gray-50 last:border-b-0"
                                    >
                                      <td className="px-2 py-1 text-xs text-gray-700 border-r border-gray-300">
                                        {interlock.interlock_name}
                                      </td>
                                      <td className="px-2 py-1 text-center text-xs text-gray-700 border-r border-gray-300">
                                        {interlock.severity || 'N/A'}
                                      </td>
                                      <td className="px-2 py-1 text-center text-xs text-gray-700">
                                        {(interlock.count || 0).toLocaleString()}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});

NestedPivotTable.displayName = 'NestedPivotTable';

export default NestedPivotTable;