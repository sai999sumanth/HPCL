import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from "@/@/components/ui/card";
import { Search, ChevronUp, ChevronDown, Download } from 'lucide-react';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

interface DetailedEquipmentData {
  interlock_name?: string;
  equipment_name?: string;
  created_at?: string;
  device_name?: string;
  sap_id?: string;
  location_name?: string;
  closed_at?: string;
  [key: string]: any;
}

interface EquipmentDetailsTableProps {
  selectedLocation: string | null;
  detailedData: DetailedEquipmentData[];
  isLoadingDetails: boolean;
  detailedCurrentPage: number;
  detailedItemsPerPage: number;
  onBackClick: () => void;
  onItemsPerPageChange: (newItemsPerPage: number) => void;
  onPageChange: (page: number) => void;
  startDate?: string;
  endDate?: string;
}

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

const EquipmentDetailsTable: React.FC<EquipmentDetailsTableProps> = ({
  selectedLocation,
  detailedData,
  isLoadingDetails,
  detailedCurrentPage,
  detailedItemsPerPage,
  onBackClick,
  onItemsPerPageChange,
  onPageChange,
  startDate,
  endDate,
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
    let data = [...detailedData];

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
        let aValue: any = a[sortColumn as keyof DetailedEquipmentData];
        let bValue: any = b[sortColumn as keyof DetailedEquipmentData];

        // Handle null/undefined values
        if (aValue == null) aValue = '';
        if (bValue == null) bValue = '';

        // Handle date values
        if (sortColumn === 'created_at' || sortColumn === 'closed_at') {
          aValue = aValue ? new Date(aValue).getTime() : 0;
          bValue = bValue ? new Date(bValue).getTime() : 0;
        } else {
          // Convert to string for comparison
          aValue = String(aValue).toLowerCase();
          bValue = String(bValue).toLowerCase();
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [detailedData, searchTerm, sortColumn, sortDirection]);

  const getPaginatedData = (data: any[], currentPage: number, itemsPerPage: number) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  };

  const getTotalPages = (data: any[], itemsPerPage: number) => {
    return Math.ceil(data.length / itemsPerPage);
  };

  /** Export current filtered & sorted rows to Excel (client-side only) */
  const handleDownloadExcel = useCallback(() => {
    if (filteredAndSortedData.length === 0) return;

    const headers = [
      'SAP ID',
      'Location Name',
      'Interlock Name',
      'Equipment Name',
      'Device Name',
      'Created At',
      'Closed At',
    ];
    const rows = filteredAndSortedData.map((row) => [
      row.sap_id ?? '',
      row.location_name ?? '',
      row.interlock_name ?? '',
      row.equipment_name ?? '',
      row.device_name ?? '',
      row.created_at ? new Date(row.created_at).toLocaleString() : '',
      row.closed_at ? dayjs(row.closed_at).format('DD MMM YYYY, HH:mm:ss') : '',
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, 'Equipment details');

    const safe = (s: string) => s.replace(/[/\\?*[\]:]/g, '-').slice(0, 80);
    const loc = selectedLocation ? safe(selectedLocation) : 'details';
    const filename = `Equipment_${loc}_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;
    XLSX.writeFile(wb, filename);
  }, [filteredAndSortedData, selectedLocation]);

  if (!selectedLocation) return null;

  return (
    <Card className="bg-white border border-gray-200 shadow-lg rounded-lg hover:shadow-xl transition-shadow duration-300 mt-4">
      <CardContent className="p-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-gray-900">
              {selectedLocation} - Equipment Details
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
              disabled={isLoadingDetails || filteredAndSortedData.length === 0}
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

        {isLoadingDetails ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">Loading detailed equipment data...</div>
          </div>
        ) : filteredAndSortedData.length > 0 ? (
          <>
            {/* Fixed Height Table Container */}
            <div className="overflow-auto max-h-96">
              <table className="w-full border-collapse table-auto">
                <thead className="bg-gray-100 sticky top-0">
                  <tr className="border-b border-gray-200">
                    <th 
                      className="text-left py-3 px-2 font-semibold text-sm text-gray-700 cursor-pointer hover:bg-gray-200 select-none bg-gray-100"
                      onClick={() => handleSort('sap_id')}
                    >
                      <div className="flex items-center gap-1">
                        SAP ID
                        <span className="inline-flex flex-col -space-y-1">
                          <ChevronUp className={`h-3 w-3 ${sortColumn === 'sap_id' && sortDirection === 'asc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                          <ChevronDown className={`h-3 w-3 ${sortColumn === 'sap_id' && sortDirection === 'desc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                        </span>
                      </div>
                    </th>
                    <th 
                      className="text-left py-3 px-2 font-semibold text-sm text-gray-700 cursor-pointer hover:bg-gray-200 select-none bg-gray-100 min-w-[120px]"
                      onClick={() => handleSort('location_name')}
                    >
                      <div className="flex items-center gap-1">
                        Location Name
                        <span className="inline-flex flex-col -space-y-1">
                          <ChevronUp className={`h-3 w-3 ${sortColumn === 'location_name' && sortDirection === 'asc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                          <ChevronDown className={`h-3 w-3 ${sortColumn === 'location_name' && sortDirection === 'desc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                        </span>
                      </div>
                    </th>
                    <th 
                      className="text-left py-3 px-2 font-semibold text-sm text-gray-700 cursor-pointer hover:bg-gray-200 select-none bg-gray-100"
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
                      className="text-left py-3 px-2 font-semibold text-sm text-gray-700 cursor-pointer hover:bg-gray-200 select-none bg-gray-100"
                      onClick={() => handleSort('equipment_name')}
                    >
                      <div className="flex items-center gap-1">
                        Equipment Name
                        <span className="inline-flex flex-col -space-y-1">
                          <ChevronUp className={`h-3 w-3 ${sortColumn === 'equipment_name' && sortDirection === 'asc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                          <ChevronDown className={`h-3 w-3 ${sortColumn === 'equipment_name' && sortDirection === 'desc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                        </span>
                      </div>
                    </th>
                    <th 
                      className="text-left py-3 px-2 font-semibold text-sm text-gray-700 cursor-pointer hover:bg-gray-200 select-none bg-gray-100 min-w-[140px]"
                      onClick={() => handleSort('device_name')}
                    >
                      <div className="flex items-center gap-1">
                        Device Name
                        <span className="inline-flex flex-col -space-y-1">
                          <ChevronUp className={`h-3 w-3 ${sortColumn === 'device_name' && sortDirection === 'asc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                          <ChevronDown className={`h-3 w-3 ${sortColumn === 'device_name' && sortDirection === 'desc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                        </span>
                      </div>
                    </th>
                    <th 
                      className="text-left py-3 px-2 font-semibold text-sm text-gray-700 cursor-pointer hover:bg-gray-200 select-none bg-gray-100"
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
                      className="text-left py-3 px-2 font-semibold text-sm text-gray-700 cursor-pointer hover:bg-gray-200 select-none bg-gray-100"
                      onClick={() => handleSort('closed_at')}
                    >
                      <div className="flex items-center gap-1">
                        Closed At
                        <span className="inline-flex flex-col -space-y-1">
                          <ChevronUp className={`h-3 w-3 ${sortColumn === 'closed_at' && sortDirection === 'asc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                          <ChevronDown className={`h-3 w-3 ${sortColumn === 'closed_at' && sortDirection === 'desc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                        </span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {getPaginatedData(filteredAndSortedData, detailedCurrentPage, detailedItemsPerPage).map((item, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-2 text-xs text-gray-900 whitespace-nowrap">
                        {item.sap_id ?? 'N/A'}
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-900">
                        {item.location_name ?? 'N/A'}
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-900 whitespace-nowrap">
                        {item.interlock_name || 'N/A'}
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-900">
                        {item.equipment_name || 'N/A'}
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-900 max-w-[280px] break-words">
                        {item.device_name ?? 'N/A'}
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-900 whitespace-nowrap">
                        {item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'}
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-900 whitespace-nowrap">
                        {item.closed_at ? dayjs(item.closed_at).format('DD MMM YYYY, HH:mm:ss') : 'N/A'}
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
                    value={detailedItemsPerPage}
                    onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
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
                  Showing {((detailedCurrentPage - 1) * detailedItemsPerPage) + 1} to {Math.min(detailedCurrentPage * detailedItemsPerPage, filteredAndSortedData.length)} of {filteredAndSortedData.length} entries
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => onPageChange(detailedCurrentPage - 1)}
                  disabled={detailedCurrentPage === 1}
                  className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300"
                >
                  Previous
                </button>

                <span className="text-xs text-gray-600">
                  Page {detailedCurrentPage} of {getTotalPages(filteredAndSortedData, detailedItemsPerPage)}
                </span>

                <button
                  onClick={() => onPageChange(detailedCurrentPage + 1)}
                  disabled={detailedCurrentPage === getTotalPages(filteredAndSortedData, detailedItemsPerPage)}
                  className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">No detailed data available for this location.</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EquipmentDetailsTable;