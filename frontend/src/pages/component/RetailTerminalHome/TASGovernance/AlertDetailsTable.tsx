import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from "@/@/components/ui/card";
import { Search, ChevronUp, ChevronDown, Download } from 'lucide-react';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

interface AlertDetailData {
  unique_id?: string;
  alert_status?: string;
  severity?: string;
  interlock_name?: string;
  location_name?: string;
  device_name?: string;
  created_at?: string;
  updated_at?: string;
  ageing_days?: number;
  [key: string]: any;
}

interface AlertDetailsTableProps {
  selectedAlert: string | null;
  alertDetailedData: AlertDetailData[];
  isLoadingAlertDetails: boolean;
  alertDetailedCurrentPage: number;
  alertDetailedItemsPerPage: number;
  onAlertBackClick: () => void;
  onAlertItemsPerPageChange: (newItemsPerPage: number) => void;
  onAlertPageChange: (page: number) => void;
  startDate?: string;
  endDate?: string;
  /** When true, render without outer Card (e.g. inside Open Alert Ageing card) */
  embedded?: boolean;
}

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

const AlertDetailsTable: React.FC<AlertDetailsTableProps> = ({
  selectedAlert,
  alertDetailedData,
  isLoadingAlertDetails,
  alertDetailedCurrentPage,
  alertDetailedItemsPerPage,
  onAlertBackClick,
  onAlertItemsPerPageChange,
  onAlertPageChange,
  startDate,
  endDate,
  embedded = false,
}) => {
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
    let data = [...alertDetailedData];

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
        let aValue: any = a[sortColumn as keyof AlertDetailData];
        let bValue: any = b[sortColumn as keyof AlertDetailData];

        // Handle null/undefined values
        if (aValue == null) aValue = '';
        if (bValue == null) bValue = '';

        // Handle numeric values
        if (sortColumn === 'ageing_days') {
          aValue = Number(aValue) || 0;
          bValue = Number(bValue) || 0;
        }

        // Handle date values
        if (sortColumn === 'created_at' || sortColumn === 'updated_at') {
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
  }, [alertDetailedData, searchTerm, sortColumn, sortDirection]);

  const getPaginatedData = (data: AlertDetailData[], currentPage: number, itemsPerPage: number) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  };

  const getTotalPages = (data: AlertDetailData[], itemsPerPage: number) => {
    return Math.ceil(data.length / itemsPerPage);
  };

  /** Export current filtered & sorted rows to Excel (client-side only) */
  const handleDownloadExcel = useCallback(() => {
    if (filteredAndSortedData.length === 0) return;

    const headers = [
      'Location',
      'Unique ID',
      'Device',
      'Interlock Name',
      'Ageing (days)',
      'Severity',
      'Alert Status',
      'Created At',
      'Closed At',
    ];
    const rows = filteredAndSortedData.map((row) => [
      row.location_name ?? '',
      row.unique_id ?? '',
      row.device_name ?? '',
      row.interlock_name ?? '',
      row.ageing_days ?? '',
      row.severity ?? '',
      row.alert_status ?? '',
      row.created_at ? new Date(row.created_at).toLocaleString() : '',
      row.alert_status === 'Close'
        ? (row.updated_at ? new Date(row.updated_at).toLocaleString() : '')
        : '',
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, 'Alert details');

    const safe = (s: string) => s.replace(/[/\\?*[\]:]/g, '-').slice(0, 80);
    const alertName = selectedAlert ? safe(selectedAlert) : 'alert';
    const filename = `AlertDetails_${alertName}_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;
    XLSX.writeFile(wb, filename);
  }, [filteredAndSortedData, selectedAlert]);

  if (!selectedAlert) {
    return null;
  }

  const content = (
    <>
          <div className="flex items-center justify-between mb-3">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold text-gray-900">
                {selectedAlert} - Alert Details
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
                disabled={isLoadingAlertDetails || filteredAndSortedData.length === 0}
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
                onClick={onAlertBackClick}
                className="w-6 h-6 bg-gray-500 text-white rounded-full hover:bg-gray-600 transition-colors flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>
          </div>

          {filteredAndSortedData.length > 0 ? (
            <>
              {/* Fixed Height Table Container */}
              <div className="overflow-auto max-h-[28rem] border border-gray-300 rounded-md">
                <table className="w-full border-collapse table-auto">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="border-b border-gray-200">
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
                        onClick={() => handleSort('device_name')}
                      >
                        <div className="flex items-center gap-1">
                          Device
                          <span className="inline-flex flex-col -space-y-1">
                            <ChevronUp className={`h-3 w-3 ${sortColumn === 'device_name' && sortDirection === 'asc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                            <ChevronDown className={`h-3 w-3 ${sortColumn === 'device_name' && sortDirection === 'desc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
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
                          Ageing (days)
                          <span className="sr-only">ageing_days</span>
                          <span className="inline-flex flex-col -space-y-1">
                            <ChevronUp className={`h-3 w-3 ${sortColumn === 'ageing_days' && sortDirection === 'asc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                            <ChevronDown className={`h-3 w-3 ${sortColumn === 'ageing_days' && sortDirection === 'desc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                          </span>
                        </div>
                      </th>
                      <th 
                        className="text-left py-3 px-2 font-semibold text-sm text-gray-700 cursor-pointer hover:bg-gray-100 select-none bg-gray-100"
                        onClick={() => handleSort('severity')}
                      >
                        <div className="flex items-center gap-1">
                          Severity
                          <span className="inline-flex flex-col -space-y-1">
                            <ChevronUp className={`h-3 w-3 ${sortColumn === 'severity' && sortDirection === 'asc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                            <ChevronDown className={`h-3 w-3 ${sortColumn === 'severity' && sortDirection === 'desc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
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
                      <th 
                        className="text-left py-3 px-2 font-semibold text-sm text-gray-700 cursor-pointer hover:bg-gray-100 select-none bg-gray-100"
                        onClick={() => handleSort('updated_at')}
                      >
                        <div className="flex items-center gap-1">
                          Closed At
                          <span className="inline-flex flex-col -space-y-1">
                            <ChevronUp className={`h-3 w-3 ${sortColumn === 'updated_at' && sortDirection === 'asc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                            <ChevronDown className={`h-3 w-3 ${sortColumn === 'updated_at' && sortDirection === 'desc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                          </span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                <tbody>
                  {getPaginatedData(filteredAndSortedData, alertDetailedCurrentPage, alertDetailedItemsPerPage).map((item, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-2 text-xs text-gray-900">
                          {item.location_name || 'N/A'}
                        </td>
                        <td className="py-2 px-2 text-xs text-gray-900 whitespace-nowrap font-mono">
                          {item.unique_id || 'N/A'}
                        </td>
                        <td className="py-2 px-2 text-xs text-gray-900">
                          {item.device_name || 'N/A'}
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
                          {item.severity || 'N/A'}
                        </td>
                        <td className="py-2 px-2 text-xs text-gray-900">
                          <span className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded-full ${
                            item.alert_status === 'Close' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {item.alert_status || 'N/A'}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-xs text-gray-900">
                          {item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'}
                        </td>
                        <td className="py-2 px-2 text-xs text-gray-900">
                          {item.alert_status === 'Close'
                            ? (item.updated_at ? new Date(item.updated_at).toLocaleString() : 'N/A')
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            {/* Page Size Selector and Pagination at Bottom */}
            <div className="flex items-center justify-between mt-1 pb-0">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-600">Show</span>
                  <select
                    value={alertDetailedItemsPerPage}
                    onChange={(e) => onAlertItemsPerPageChange(Number(e.target.value))}
                    className="px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm text-gray-600">entries</span>
                </div>
                <div className="text-xs text-gray-600">
                  Showing {((alertDetailedCurrentPage - 1) * alertDetailedItemsPerPage) + 1} to {Math.min(alertDetailedCurrentPage * alertDetailedItemsPerPage, filteredAndSortedData.length)} of {filteredAndSortedData.length} entries
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => onAlertPageChange(alertDetailedCurrentPage - 1)}
                  disabled={alertDetailedCurrentPage === 1}
                  className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300"
                >
                  Previous
                </button>

                <span className="text-xs text-gray-600">
                  Page {alertDetailedCurrentPage} of {getTotalPages(filteredAndSortedData, alertDetailedItemsPerPage)}
                </span>

                <button
                  onClick={() => onAlertPageChange(alertDetailedCurrentPage + 1)}
                  disabled={alertDetailedCurrentPage === getTotalPages(filteredAndSortedData, alertDetailedItemsPerPage)}
                  className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300"
                >
                  Next
                </button>
              </div>
            </div>

            </>
          ) : isLoadingAlertDetails ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500">Loading detailed alert data...</div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500">No detailed data available for this alert.</div>
            </div>
          )}
    </>
  );

  if (embedded) {
    return <div className="w-full h-full flex flex-col min-h-0">{content}</div>;
  }

  return (
    <div className="w-full mt-4">
      <Card className="bg-white border border-gray-200 shadow-lg rounded-lg hover:shadow-xl transition-shadow duration-300">
        <CardContent className="p-2">
          {content}
        </CardContent>
      </Card>
    </div>
  );
};

export default AlertDetailsTable;