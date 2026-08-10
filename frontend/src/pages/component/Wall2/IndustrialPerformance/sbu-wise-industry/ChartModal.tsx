import React from 'react';
import ReactECharts from 'echarts-for-react';
import { X, Table, BarChart } from 'lucide-react';
import { TableColumn } from './types';

const metrics = [
  { key: 'total_sales', label: 'Sales', unit: '' },
  { key: 'curr_mkt', label: 'Current Mkt %', unit: '%' },
  { key: 'his_mkt', label: 'Hist. Mkt %', unit: '%' },
  { key: 'gain_loss', label: 'Gain/Loss %', unit: '%' },
  { key: 'growth', label: 'Growth %', unit: '%' },
];

type MetricKey = 'gain_loss' | 'total_sales' | 'curr_mkt' | 'his_mkt' | 'growth';
type ViewType = 'table' | 'chart';

const getChartOption = (data: any[], nameKey: string, selectedMetric: MetricKey) => {
  const metricInfo = metrics.find(m => m.key === selectedMetric)!;
  const chartLabels = data.map(item => item[nameKey]);
  
  const chartData = data.map(item => {
    const value = item[selectedMetric];
    let itemStyle = { color: '#3b82f6' };
    
    if (selectedMetric === 'gain_loss' || selectedMetric === 'growth') {
      itemStyle = { color: value >= 0 ? '#22c55e' : '#ef4444' };
    }
    
    return { value, itemStyle };
  });

  const formatAxisLabel = (value: number) => {
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value;
  };

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any[]) => {
        const item = data[params[0].dataIndex];
        if (!item) return '';
        const value = item[selectedMetric];
        const gainLossColor = item.gain_loss >= 0 ? '#16a34a' : '#dc2626';
        const growthColor = (item.growth || 0) >= 0 ? '#16a34a' : '#dc2626';
        
        let formattedValue = metricInfo.unit === '%'
          ? `${value > 0 && (selectedMetric === 'gain_loss' || selectedMetric === 'growth') ? '+' : ''}${value.toFixed(2)}%`
          : value.toLocaleString();

        return `
          <div class="text-xs">
            <div class="font-bold">${item[nameKey]}</div>
            <div>${metricInfo.label}: <strong>${formattedValue}</strong></div>
            <hr class="my-1 border-gray-200" />
            <div>Sales: <strong>${item.total_sales.toLocaleString()}</strong></div>
            <div>Current Mkt %: <strong>${item.curr_mkt}%</strong></div>
            <div>Historical Mkt %: <strong>${item.his_mkt}%</strong></div>
            <div>Gain/Loss: <strong style="color: ${gainLossColor}">
              ${item.gain_loss > 0 ? '+' : ''}${item.gain_loss.toFixed(2)}%
            </strong></div>
            ${item.growth !== undefined ? `
            <div>Growth: <strong style="color: ${growthColor}">
              ${(item.growth || 0) > 0 ? '+' : ''}${(item.growth || 0).toFixed(2)}%
            </strong></div>
            ` : ''}
          </div>
        `;
      },
    },
    grid: { top: 60, right: 40, bottom: 80, left: 70 },
    xAxis: {
      type: 'category',
      data: chartLabels,
      axisLabel: {
        interval: 0,
        rotate: chartLabels.length > 15 ? 45 : 0,
        fontSize: 10,
        color: '#4b5563'
      },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        fontSize: 10,
        color: '#4b5563',
        formatter: (value: number) => metricInfo.unit === '%' ? `${value}%` : formatAxisLabel(value),
      },
    },
    series: [
      {
        name: metricInfo.label,
        type: 'bar',
        data: chartData,
        barWidth: '60%',
        barMaxWidth: 50,
        label: {
            show: true,
            position: 'top',
            formatter: (params: any) => {
              const val = params.value;
              if (metricInfo.unit === '%') {
                return `${val > 0 && (selectedMetric === 'gain_loss' || selectedMetric === 'growth') ? '+' : ''}${val.toFixed(2)}%`;
              }
              return formatAxisLabel(val);
            },
            fontSize: 9,
            color: '#333'
        }
      },
    ],
  };
};

const SimpleTableView: React.FC<{ data: any[]; type: 'zones' | 'regions' | 'districts'; }> = ({ data, type }) => {
    const getColumns = (): TableColumn[] => {
        const nameColumn: TableColumn = 
            type === 'zones' ? { key: 'zone_name', label: 'Zone', type: 'string' } :
            type === 'regions' ? { key: 'region_name', label: 'Region', type: 'string' } :
            { key: 'district_name', label: 'District', type: 'string', getValue: (item: any) => item.distname || item.district_name || 'N/A' };

        const commonColumns: TableColumn[] = [
          { key: 'total_sales', label: 'Sales', type: 'number', format: (value) => value },
          { key: 'curr_mkt', label: 'curr mkt %', type: 'percentage', format: (value) => `${value}%` },
          { key: 'his_mkt', label: 'his mkt %', type: 'percentage', format: (value) => `${value}%` },
          { key: 'gain_loss', label: 'G/L %', type: 'percentage', format: (value) => `${Number(value) > 0 ? '+' : ''}${value}%` }
        ];

        // Add growth column if present in data
        if (data.length > 0 && data[0].growth !== undefined) {
          commonColumns.push({
            key: 'growth', 
            label: 'Growth %', 
            type: 'percentage', 
            format: (value) => `${Number(value) > 0 ? '+' : ''}${(value || 0).toFixed(2)}%`
          });
        }
    
        return [nameColumn, ...commonColumns];
    };

    const columns = getColumns();

    const getCellStyle = (column: TableColumn, value: any) => {
        if (column.key === 'gain_loss' || column.key === 'growth') {
            const num = Number(value);
            if (num > 0) return 'text-green-600 font-medium';
            if (num < 0) return 'text-red-600 font-medium';
        }
        if (column.key.includes('name')) return 'font-medium text-gray-900';
        return 'text-gray-700';
    };

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

    return (
        <div className="overflow-auto h-full">
            <table className="min-w-full">
                <thead className="bg-gray-50 sticky top-0">
                    <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase w-12">S.No</th>
                        {columns.map((col) => (
                            <th key={col.key} className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase">{col.label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                    {data.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-2 whitespace-nowrap text-sm font-bold text-gray-900 bg-gray-50 w-12">{index + 1}</td>
                            {columns.map((col) => (
                                <td key={col.key} className={`px-4 py-2 whitespace-nowrap text-sm ${getCellStyle(col, item[col.key])}`}>
                                    {renderCellValue(item, col)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

interface ChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: any[];
  nameKey: string;
  type: 'zones' | 'regions' | 'districts';
  view: ViewType;
  onViewChange: (view: ViewType) => void;
  selectedMetric: MetricKey;
  onMetricChange: (metric: MetricKey) => void;
}

const ChartModal: React.FC<ChartModalProps> = ({ isOpen, onClose, title, data, nameKey, type, view, onViewChange, selectedMetric, onMetricChange }) => {

  if (!isOpen) { 
    return null;
  }
  
  const chartOption = getChartOption(data, nameKey, selectedMetric);

  return ( 
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 transition-opacity duration-300"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-2xl w-full max-w-6xl h-full max-h-[85vh] flex flex-col transform transition-transform duration-300 scale-95"
        onClick={(e) => e.stopPropagation()}
        style={{ transform: 'scale(1)' }}
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b p-4 gap-3">
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          
          <div className="flex items-center gap-4">
            {view === 'chart' && (
              <div className="flex flex-wrap items-center gap-1 bg-gray-100 p-1 rounded-md">
                {metrics.map(metric => (
                  <button
                    key={metric.key}
                    onClick={() => onMetricChange(metric.key as MetricKey)}
                    className={`px-2 py-1 text-xs rounded transition-all ${
                      selectedMetric === metric.key
                        ? 'bg-white text-blue-600 font-semibold shadow-sm'
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {metric.label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md">
              <button
                onClick={() => onViewChange('table')}
                className={`p-1.5 rounded transition-all ${
                  view === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'
                }`}
                title="Tabular View"
              >
                <Table className="h-4 w-4" />
              </button>
              <button
                onClick={() => onViewChange('chart')}
                className={`p-1.5 rounded transition-all ${
                  view === 'chart' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'
                }`}
                title="Bar Chart"
              >
                <BarChart className="h-4 w-4" />
              </button>
            </div>
            
            <button 
              onClick={onClose} 
              className="text-gray-500 hover:text-gray-800 p-1 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
        <div className="flex-grow p-4 overflow-hidden">
          {view === 'chart' ? (
            <ReactECharts
              option={chartOption}
              style={{ height: '100%', width: '100%' }}
              notMerge={true}
            />
          ) : (
            <SimpleTableView data={data} type={type} />
          )}
        </div>
      </div>
    </div>
  );
};

export default ChartModal;