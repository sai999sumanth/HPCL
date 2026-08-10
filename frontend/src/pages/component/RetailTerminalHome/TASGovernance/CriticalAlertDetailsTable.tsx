import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiClient } from "@/services/apiClient";
import { Card, CardContent } from "@/@/components/ui/card";
import { Search, ChevronUp, ChevronDown, Download } from 'lucide-react';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

interface CriticalAlertDetail {
  unique_id: string;
  zone: string;
  alert_status: string;
  interlock_name: string;
  location_name: string;
  created_at: string;
  ageing_days: number;
}

interface CriticalAlertDetailsTableProps {
  selectedLocation: string | null;
  onBackClick: () => void;
  startDate?: string;
  endDate?: string;
  alertSeverity?: string[];
}

const CriticalAlertDetailsTable: React.FC<CriticalAlertDetailsTableProps> = ({
  selectedLocation,
  onBackClick,
  startDate,
  endDate,
  alertSeverity = [''],
}) => {
  const [alertDetails, setAlertDetails] = useState<CriticalAlertDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Handle column sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, start with ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let data = [...alertDetails];

    // Apply search filter
    if (searchTerm) {
      data = data.filter(item =>
      Object.values(item).some(value =>
        value && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
    }

    // Apply sorting
    if (sortColumn) {
      data.sort((a, b) => {
        let aValue: any = a[sortColumn as keyof CriticalAlertDetail];
        let bValue: any = b[sortColumn as keyof CriticalAlertDetail];

        // Handle null/undefined values
        if (aValue == null) aValue = '';
        if (bValue == null) bValue = '';

        // Handle numeric values
        if (sortColumn === 'ageing_days') {
          aValue = Number(aValue) || 0;
          bValue = Number(bValue) || 0;
        }

        // Handle date values
        if (sortColumn === 'created_at') {
          aValue = aValue ? new Date(aValue).getTime() : 0;
          bValue = bValue ? new Date(bValue).getTime() : 0;
        }

        // Convert to string for comparison if not numeric/date
        if (typeof aValue !== 'number' && typeof bValue !== 'number') {
          aValue = String(aValue).toLowerCase();
          bValue = String(bValue).toLowerCase();
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [alertDetails, searchTerm, sortColumn, sortDirection]);

  useEffect(() => {
    if (selectedLocation) {
      fetchAlertDetails();
    }
  }, [selectedLocation, startDate, endDate, alertSeverity]);

  const fetchAlertDetails = async () => {
    if (!selectedLocation) return;

    try {
      setIsLoading(true);
      setError(null);

      const payload = {
        "analytical_model": "Location Alert Critical",
        "location_name": selectedLocation,
        "alert_severity": alertSeverity,
        "alert_status": "Open",
        "start_date": startDate || new Date().toISOString().split('T')[0],
        "end_date": endDate || new Date().toISOString().split('T')[0],
        "top_n": 10
      };

      const response = await apiClient.post('/api/tasanalytics/tas_analytics', payload);

      if (response && response.data) {
        const apiData = response.data?.data ?? response.data;
        let dataArray: CriticalAlertDetail[] = [];

        // API returns { status, message, data: [...] }
        if (typeof apiData === 'object' && apiData !== null && 'data' in apiData && Array.isArray((apiData as { data: unknown }).data)) {
          dataArray = (apiData as { data: CriticalAlertDetail[] }).data;
        } else if (Array.isArray(apiData)) {
          dataArray = apiData;
        } else if (typeof apiData === 'object' && apiData !== null) {
          dataArray = Object.values(apiData);
        }

        setAlertDetails(dataArray);
      }
    } catch (err) {
      console.error('Error fetching alert details:', err);
      setError('Failed to load alert details');
      setAlertDetails([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getPaginatedData = (data: CriticalAlertDetail[], page: number, perPage: number) => {
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    return data.slice(startIndex, endIndex);
  };

  const getTotalPages = (data: CriticalAlertDetail[], itemsPerPage: number) => {
    return Math.ceil(data.length / itemsPerPage);
  };

  /** Export current filtered & sorted rows to Excel (client-side only) */
  const handleDownloadExcel = useCallback(() => {
    if (filteredAndSortedData.length === 0) return;

    const headers = [
      'Zone',
      'Location',
      'Unique ID',
      'Interlock Name',
      'Ageing Status (days)',
      'Alert Status',
      'Created At',
    ];
    const rows = filteredAndSortedData.map((row) => [
      row.zone ?? '',
      row.location_name ?? '',
      row.unique_id ?? '',
      row.interlock_name ?? '',
      row.ageing_days ?? '',
      row.alert_status ?? '',
      row.created_at ? new Date(row.created_at).toLocaleString() : '',
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, 'Critical alerts');

    const safe = (s: string) => s.replace(/[/\\?*[\]:]/g, '-').slice(0, 80);
    const loc = selectedLocation ? safe(selectedLocation) : 'location';
    const filename = `CriticalAlert_${loc}_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;
    XLSX.writeFile(wb, filename);
  }, [filteredAndSortedData, selectedLocation]);

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Format severity for display in title
  const getSeverityDisplay = () => {
    if (!alertSeverity || alertSeverity.length === 0 || (alertSeverity.length === 1 && alertSeverity[0] === '')) {
      return ' (All)';
    }
    const validSeverities = alertSeverity.filter(s => s && s !== '');
    if (validSeverities.length === 0) {
      return ' (All)';
    }
    return ` (${validSeverities.map(s => s.toLowerCase()).join('+')})`;
  };

  if (!selectedLocation) return null;

  return (
    <Card className="bg-white border border-gray-200 shadow-lg rounded-lg hover:shadow-xl transition-shadow duration-300 mt-1">
      <CardContent className="p-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-gray-900">
              {selectedLocation} - Open Alert Details{getSeverityDisplay()}
            </h4>
            {(startDate || endDate) && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                {startDate && endDate
                  ? `${dayjs(startDate).format('DD MMM YYYY')} – ${dayjs(endDate).format('DD MMM YYYY')}`
                  : startDate
                    ? dayjs(startDate).format('DD MMM YYYY')
                    : endDate
                      ? dayjs(endDate).format('DD MMM YYYY')
                      : ''}
              </span>
            )}
            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={isLoading || filteredAndSortedData.length === 0}
              title="Download Excel (current filtered table data)"
              aria-label="Download Excel"
              className="inline-flex items-center justify-center shrink-0 rounded-md border border-green-600 bg-green-600 p-1.5 text-white shadow-sm hover:bg-green-700 hover:border-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-3.5 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-48"
              />
            </div>

            <button
              onClick={onBackClick}
              className="w-6 h-6 bg-gray-500 text-white rounded-full hover:bg-gray-600 transition-colors flex items-center justify-center text-sm"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">Loading critical alert details...</div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex items-center justify-center py-8">
            <div className="text-red-500">{error}</div>
          </div>
        )}

        {/* Table */}
        {!isLoading && !error && filteredAndSortedData.length > 0 && (
          <>
            {/* Fixed Height Table Container */}
            <div className="overflow-auto max-h-96">
              <table className="w-full border-collapse table-auto">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="border-b border-gray-200">
                    <th 
                      className="text-left py-3 px-2 font-semibold text-sm text-gray-700 cursor-pointer hover:bg-gray-100 select-none bg-gray-100"
                      onClick={() => handleSort('zone')}
                    >
                      <div className="flex items-center gap-1">
                        Zone
                        <span className="inline-flex flex-col -space-y-1">
                          <ChevronUp className={`h-3 w-3 ${sortColumn === 'zone' && sortDirection === 'asc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                          <ChevronDown className={`h-3 w-3 ${sortColumn === 'zone' && sortDirection === 'desc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                        </span>
                      </div>
                    </th>
                    <th 
                      className="text-left py-3 px-2 font-semibold text-sm text-gray-700 cursor-pointer hover:bg-gray-100 select-none bg-gray-100"
                      onClick={() => handleSort('location_name')}
                    >
                      <div className="flex items-center gap-1">
                        Location
                        <span className="inline-flex flex-col -space-y-1">
                          <ChevronUp className={`h-3 w-3 ${sortColumn === 'location_name' && sortDirection === 'asc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                          <ChevronDown className={`h-3 w-3 ${sortColumn === 'location_name' && sortDirection === 'desc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                        </span>
                      </div>
                    </th>
                    <th 
                      className="text-left py-3 px-2 font-semibold text-sm text-gray-700 cursor-pointer hover:bg-gray-100 select-none bg-gray-100"
                      onClick={() => handleSort('unique_id')}
                    >
                      <div className="flex items-center gap-1">
                        Unique ID
                        <span className="inline-flex flex-col -space-y-1">
                          <ChevronUp className={`h-3 w-3 ${sortColumn === 'unique_id' && sortDirection === 'asc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                          <ChevronDown className={`h-3 w-3 ${sortColumn === 'unique_id' && sortDirection === 'desc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                        </span>
                      </div>
                    </th>
                    <th 
                      className="text-left py-3 px-2 font-semibold text-sm text-gray-700 cursor-pointer hover:bg-gray-100 select-none bg-gray-100"
                      onClick={() => handleSort('interlock_name')}
                    >
                      <div className="flex items-center gap-1">
                        Interlock Name
                        <span className="inline-flex flex-col -space-y-1">
                          <ChevronUp className={`h-3 w-3 ${sortColumn === 'interlock_name' && sortDirection === 'asc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                          <ChevronDown className={`h-3 w-3 ${sortColumn === 'interlock_name' && sortDirection === 'desc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                        </span>
                      </div>
                    </th>
                    <th 
                      className="text-left py-3 px-2 font-semibold text-sm text-gray-700 cursor-pointer hover:bg-gray-100 select-none bg-gray-100"
                      onClick={() => handleSort('ageing_days')}
                    >
                      <div className="flex items-center gap-1">
                        Ageing Status(days)
                        <span className="inline-flex flex-col -space-y-1">
                          <ChevronUp className={`h-3 w-3 ${sortColumn === 'ageing_days' && sortDirection === 'asc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                          <ChevronDown className={`h-3 w-3 ${sortColumn === 'ageing_days' && sortDirection === 'desc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                        </span>
                      </div>
                    </th>
                    <th 
                      className="text-left py-3 px-2 font-semibold text-sm text-gray-700 cursor-pointer hover:bg-gray-100 select-none bg-gray-100"
                      onClick={() => handleSort('alert_status')}
                    >
                      <div className="flex items-center gap-1">
                        Alert Status
                        <span className="inline-flex flex-col -space-y-1">
                          <ChevronUp className={`h-3 w-3 ${sortColumn === 'alert_status' && sortDirection === 'asc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                          <ChevronDown className={`h-3 w-3 ${sortColumn === 'alert_status' && sortDirection === 'desc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                        </span>
                      </div>
                    </th>
                    <th 
                      className="text-left py-3 px-2 font-semibold text-sm text-gray-700 cursor-pointer hover:bg-gray-100 select-none bg-gray-100"
                      onClick={() => handleSort('created_at')}
                    >
                      <div className="flex items-center gap-1">
                        Created At
                        <span className="inline-flex flex-col -space-y-1">
                          <ChevronUp className={`h-3 w-3 ${sortColumn === 'created_at' && sortDirection === 'asc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                          <ChevronDown className={`h-3 w-3 ${sortColumn === 'created_at' && sortDirection === 'desc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                        </span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {getPaginatedData(filteredAndSortedData, currentPage, itemsPerPage).map((item, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-2 text-xs text-gray-900">
                        {item.zone || 'N/A'}
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-900">
                        {item.location_name || 'N/A'}
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-900 font-mono">
                        {item.unique_id || 'N/A'}
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-900">
                        {item.interlock_name || 'N/A'}
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-900">
                        <span className="font-medium text-red-600">
                          {item.ageing_days ?? 0}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-900">
<span className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded-full ${
                          item.alert_status === 'Open' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                          }`}>
                          {item.alert_status || 'N/A'}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-900">
                        {item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Page Size Selector and Pagination at Bottom */}
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-600">Show</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                    className="px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-sm text-gray-600">entries</span>
                </div>
                <div className="text-xs text-gray-600">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedData.length)} of {filteredAndSortedData.length} entries
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300"
                >
                  Previous
                </button>

                <span className="text-xs text-gray-600">
                  Page {currentPage} of {getTotalPages(filteredAndSortedData, itemsPerPage)}
                </span>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === getTotalPages(filteredAndSortedData, itemsPerPage)}
                  className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredAndSortedData.length === 0 && alertDetails.length > 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">No critical alert details found for {selectedLocation}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CriticalAlertDetailsTable;