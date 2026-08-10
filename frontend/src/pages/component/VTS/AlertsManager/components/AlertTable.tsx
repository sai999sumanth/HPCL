import React from 'react';
import { Checkbox } from './ui/checkbox';
import Pagination from './Pagination';
import { AlertRecord, PaginationInfo } from '../types';

interface AlertTableProps {
  data: AlertRecord[]; // This will be the data for the current page
  fullData: AlertRecord[]; // This is the full dataset
  selectedRecords: number[];
  onSelectRecord: (id: number) => void;
  onSelectAll: (checked: boolean) => void;
  isAllOnPageSelected: boolean;
  isLoading: boolean;
  pagination: PaginationInfo;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  hideCheckboxes?: boolean; // Optional prop to hide checkboxes
}

const formatDateTime = (dateString?: string, isUtc: boolean = false) => {
  if (!dateString) return 'N/A';
  try {
    // Example format: 22 Aug 2025 14:10
    // return new Date(dateString).toLocaleString('en-GB', {

     const hasOffset = /Z$|[+-]\d{2}:\d{2}$/.test(dateString);
    const parsedString = (isUtc && !hasOffset) ? `${dateString}Z` : dateString;

    return new Date(parsedString).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).replace(',', '');
  } catch (e) {
    return 'Invalid Date';
  }
};

const AlertTable: React.FC<AlertTableProps> = ({
  data,
  fullData,
  selectedRecords,
  onSelectRecord,
  onSelectAll,
  isAllOnPageSelected,
  isLoading,
  pagination,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  hideCheckboxes = false
}) => {
  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'bu', label: 'BU' },
    { key: 'tt_number', label: 'TT Number' },
    { key: 'sap_id', label: 'SAP ID' },
    { key: 'zone', label: 'Zone' },
    { key: 'location_name', label: 'Location Name', truncate: true },
    { key: 'severity', label: 'Severity' },
    { key: 'instance_level', label: 'Instance Level', truncate: true },
    { key: 'instance_status', label: 'Instance Status' },
    { key: 'violation_type', label: 'Violation Type', truncate: true },
    { key: 'maker', label: 'Maker', truncate: true },
    { key: 'checker', label: 'Checker', truncate: true },
    { key: 'actual_trip_end_date', label: 'Actual Trip End' },
    { key: 'novex_alert_created_date', label: 'Novex Alert Created' },
    { key: 'vehicle_blocked_start_date', label: 'Vehicle Blocked Start' },
    { key: 'vehicle_blocked_end_date', label: 'Vehicle Blocked End' },
  ];

  const getSeverityBadgeColor = (severity?: string) => {
    if (!severity) return 'bg-gray-100 text-gray-800 border-gray-200';
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusBadgeColor = (status?: string) => {
    if (!status) return 'bg-gray-100 text-gray-800 border-gray-200';
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('instance - 3')) {
      return 'bg-blue-700 text-white border-blue-800'; // Dark Blue
    }
    if (lowerStatus.includes('instance - 2')) {
      return 'bg-blue-400 text-white border-blue-500'; // Light Blue
    }
    if (lowerStatus.includes('instance - 1')) {
      return 'bg-blue-200 text-blue-800 border-blue-300'; // Lighter Blue
    }
    return 'bg-gray-100 text-gray-800 border-gray-200'; // Default for other instances
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border shadow-sm h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading alerts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
      <div className="overflow-auto h-[60vh]">
        <table className="min-w-full table-auto">
          <thead className="sticky top-0 z-20">
            <tr className="border-b bg-gray-50">
              {!hideCheckboxes && (
                <th className="text-left px-2 py-1 font-medium text-xs sticky left-0 bg-gray-50 z-30 w-[40px]">
                  <Checkbox
                    checked={isAllOnPageSelected}
                    onCheckedChange={onSelectAll}
                  />
                </th>
              )}
              {columns.map((column) => (
                <th key={column.key} className="text-left px-2 py-1 font-medium text-xs border-r border-gray-200 whitespace-nowrap">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fullData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (hideCheckboxes ? 0 : 1)} className="text-center p-8 text-gray-500">
                  No violation records found matching your filters.
                </td>
              </tr>
            ) : (
              data.map((record) => (
                <tr key={record.id} className="border-b hover:bg-gray-50">
                  {!hideCheckboxes && (
                    <td className="px-2 py-1 sticky left-0 bg-white hover:bg-gray-50 z-10">
                      <Checkbox
                        checked={selectedRecords.includes(record.id)}
                        onCheckedChange={() => onSelectRecord(record.id)}
                      />
                    </td>
                  )}
                  {columns.map((column) => {
                    const value = record[column.key as keyof AlertRecord];
                    const titleValue = Array.isArray(value) ? value.join(', ') : (typeof value === 'string' ? value : '');
                    let displayValue: React.ReactNode = Array.isArray(value) ? value.join(', ') : value;

                    if (column.key === 'severity') {
                      displayValue = (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getSeverityBadgeColor(record.severity)}`}>
                          {record.severity || 'N/A'}
                        </span>
                      );
                    } else if (column.key === 'instance_status') {
                      displayValue = (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeColor(record.instance_status)}`}>
                          {record.instance_status || 'N/A'}
                        </span>
                      );
                    // } else if (column.key.includes('_date')) {
                    //   displayValue = formatDateTime(value as string);
                    // }
} else if (column.key.includes('_date')) {
  displayValue = formatDateTime(value as string, column.key === 'novex_alert_created_date');
}
                    return (
                      <td key={column.key} className="px-2 py-1 text-xs border-r border-gray-100">
                        <div className={column.truncate ? 'truncate' : ''} title={column.truncate ? titleValue : undefined}>
                            {displayValue || 'N/A'}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {pagination && pagination.total > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={pagination.totalPages}
          pageSize={pageSize}
          totalRecords={pagination.total}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
};

export default AlertTable;
