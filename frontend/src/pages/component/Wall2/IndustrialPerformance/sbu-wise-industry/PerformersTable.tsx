import React from 'react';
import { Loader2, MapPin, Globe, Building2, AlertCircle } from 'lucide-react';
import { TableColumn } from './types';

interface MessageState {
  text: string;
  type: 'error' | 'info';
}

interface PerformersTableProps {
  title: string;
  data: any[];
  loading: boolean;
  message: MessageState | null;
  type: 'zones' | 'regions' | 'districts';
}

const PerformersTable: React.FC<PerformersTableProps> = ({ 
  title,
  data,
  loading,
  message,
  type
}) => {
  const getColumns = (): TableColumn[] => {
    const commonColumns: TableColumn[] = [
      { 
        key: 'total_sales', 
        label: 'Sales', 
        type: 'number',
        format: (value) => value
      },
      { 
        key: 'curr_mkt', 
        label: 'Current %', 
        type: 'percentage',
        format: (value) => `${value}%`
      },
      { 
        key: 'his_mkt', 
        label: 'Historical %', 
        type: 'percentage',
        format: (value) => `${value}%`
      },
      { 
        key: 'gain_loss', 
        label: 'Gain/Loss', 
        type: 'percentage',
        format: (value) => {
          const num = Number(value);
          return `${num > 0 ? '+' : ''}${value}%`; 
        }
      }
    ];

    // Add growth column if present in data
    if (data.length > 0 && data[0].growth !== undefined) {
      commonColumns.push({
        key: 'growth', 
        label: 'Growth %', 
        type: 'percentage',
        format: (value) => {
          const num = Number(value || 0);
          return `${num > 0 ? '+' : ''}${num.toFixed(2)}%`;
        }
      });
    }

    if (type === 'zones') {
      return [
        { key: 'zone_name', label: 'Zone', type: 'string' },
        ...commonColumns
      ];
    } else if (type === 'regions') {
      return [
        { key: 'region_name', label: 'Region', type: 'string' },
        ...commonColumns
      ];
    } else { // districts
      return [
        // Handle different district name keys
        { 
          key: 'district_name', 
          label: 'District', 
          type: 'string' as const,
          // Custom getter to handle both district_name and distname
          getValue: (item: any) => item.distname || item.district_name || 'N/A'
        },
        ...commonColumns
      ];
    }
  };

  const columns = getColumns();

  if (loading) {
    return (
      <div className="bg-white rounded-md shadow-sm border flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        <span className="ml-2 text-sm text-gray-600">Loading...</span>
      </div>
    );
  }

  if (message?.type === 'error' && data.length === 0) {
    return (
      <div className="bg-white rounded-md shadow-sm border flex flex-col items-center justify-center h-64">
        <AlertCircle className="h-8 w-8 text-red-400 mb-2" />
        <p className="text-sm text-red-600 font-medium">Could not load data</p>
        <p className="text-xs text-gray-500 mt-1">An error occurred while fetching data.</p>
      </div>
    );
  }

  const renderCellValue = (item: any, column: TableColumn) => {
    let value: any;
    
    // Handle custom getValue function for district names
    if (column.getValue) {
      value = column.getValue(item);
    } else {
      value = item[column.key];
    }
    
    if (value === null || value === undefined) {
      return 'N/A';
    }

    if (column.format) {
      return column.format(value);
    }

    if (column.type === 'number') {
      return typeof value === 'number' ? value.toLocaleString() : value;
    }

    return value;
  };

  const getCellStyle = (column: TableColumn, value: any) => {
    if (column.key === 'gain_loss' || column.key === 'growth') {
      const num = Number(value);
      if (num > 0) return 'text-green-600 font-medium';
      if (num < 0) return 'text-red-600 font-medium';
      return 'text-gray-600 font-medium';
    }
    
    if (column.key === 'total_sales') {
      return 'font-medium text-blue-600';
    }
    
    if (column.key.includes('name')) {
      return 'font-medium text-gray-900';
    }
    
    return 'text-gray-700';
  };

  const renderTableContent = () => {
    if (!data || data.length === 0) {
      const noDataMessage = message && message.type === 'info' 
        ? message.text 
        : 'No data to display.';
      
      return (
        <tr>
          <td colSpan={columns.length + 1} className="px-3 py-10 text-center text-gray-500 text-sm">
            {noDataMessage}
          </td>
        </tr>
      );
    }

    return data.map((item, index) => (
      <tr key={index} className="hover:bg-gray-50 transition-colors duration-150">
        <td className="px-3 py-2 whitespace-nowrap text-xs font-bold text-gray-900 bg-gray-50 w-8">
          {index + 1}
        </td>
        {columns.map((column) => (
          <td 
            key={column.key} 
            className={`px-3 py-2 whitespace-nowrap text-xs ${getCellStyle(column, item[column.key])}`}
          >
            {renderCellValue(item, column)}
          </td>
        ))}
      </tr>
    ));
  };

  return (
    <div className="bg-white rounded-md shadow-sm border overflow-hidden">
      <div className="px-3 py-2 bg-gray-50 border-b">
        <h3 className="text-sm font-semibold flex items-center justify-between">
          <div className="flex items-center">
            {type === 'zones' ? (
              <MapPin className="h-4 w-4 text-gray-600 mr-1" />
            ) : type === 'regions' ? (
              <Globe className="h-4 w-4 text-gray-600 mr-1" />
            ) : (
              <Building2 className="h-4 w-4 text-gray-600 mr-1" />
            )}
            <span className="text-gray-800">{title}</span>
          </div>
          <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
            {data.length} items
          </span>
        </h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-8">
                #
              </th>
              {columns.map((column) => (
                <th 
                  key={column.key}
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {renderTableContent()}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PerformersTable;