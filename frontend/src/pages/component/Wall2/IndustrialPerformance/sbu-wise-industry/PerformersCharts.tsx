import React from 'react';
import ReactECharts from 'echarts-for-react';
import { Loader2, AlertCircle, Info, MapPin, Globe, Building2, BarChart, Table, Maximize } from 'lucide-react';
import { ZoneData, RegionData, DistrictData, TableColumn } from './types';

interface MessageState {
  text: string;
  type: 'error' | 'info';
}

type MetricKey = 'gain_loss' | 'total_sales' | 'curr_mkt' | 'his_mkt' | 'growth';
type ViewType = 'table' | 'chart';

interface ChartWrapperProps {
  title: string;
  icon: React.ReactNode;
  data: any[];
  nameKey: string;
  type: 'zones' | 'regions' | 'districts';
  onMaximize: (chartInfo: { title: string; data: any[]; nameKey: string; type: 'zones' | 'regions' | 'districts'; }) => void;
  onRowClick?: (item: any) => void;
  metric: MetricKey;
  onMetricChange: (metric: MetricKey) => void;
  view: ViewType;
  onViewChange: (view: ViewType) => void;
}

const metrics = [
  { key: 'total_sales', label: 'Sales', unit: '' },
  { key: 'curr_mkt', label: 'Current Mkt %', unit: '%' },
  { key: 'his_mkt', label: 'Hist. Mkt %', unit: '%' },
  { key: 'gain_loss', label: 'Gain/Loss %', unit: '%' },
  { key: 'growth', label: 'Growth %', unit: '%' },
];

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
    grid: { top: 40, right: 30, bottom: 80, left: 60 },
    xAxis: {
      type: 'category',
      data: chartLabels,
      axisLabel: {
        interval: 0,
        rotate: chartLabels.length > 8 ? 45 : 0,
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
    toolbox: {
      show: true,
      right: 20,
      top: 5,
      feature: {
        saveAsImage: { show: false },
        restore: { show: true, title: 'Restore' },
      },
    },
  };
};

const SimpleTableView: React.FC<{ data: any[]; type: 'zones' | 'regions' | 'districts'; onRowClick?: (item: any) => void; }> = ({ data, type, onRowClick }) => {
    const getColumns = (): TableColumn[] => {
        const nameColumn: TableColumn = 
            type === 'zones' ? { key: 'zone_name', label: 'Zone', type: 'string' } :
            type === 'regions' ? { key: 'region_name', label: 'Region', type: 'string' } :
            { 
              key: 'district_name', 
              label: 'District', 
              type: 'string',
              getValue: (item: any) => item.district_name || item.distname || 'N/A'
            };

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
        <div className="overflow-x-auto max-h-[350px]">
            <table className="min-w-full">
                <thead className="bg-gray-50 sticky top-0">
                    <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-8">S.No</th>
                        {columns.map((col) => (
                            <th key={col.key} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{col.label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                    {data.map((item, index) => (
                        <tr 
                            key={index} 
                            onClick={() => onRowClick && onRowClick(item)}
                            className={`hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}
                        >
                            <td className="px-3 py-2 whitespace-nowrap text-xs font-bold text-gray-900 bg-gray-50 w-8">{index + 1}</td>
                            {columns.map((col) => (
                                <td key={col.key} className={`px-3 py-2 whitespace-nowrap text-xs ${getCellStyle(col, item[col.key])}`}>
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

const ChartWrapper: React.FC<ChartWrapperProps> = ({ title, icon, data, nameKey, type, onMaximize, onRowClick, metric, onMetricChange, view, onViewChange }) => {

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-md shadow-sm border">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="text-sm font-semibold flex items-center text-gray-800">
          {icon}
          {title}
        </h3>
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
            onClick={() => {
              onViewChange('chart');
              onMetricChange('total_sales'); // Reset metric to Sales
            }}
            className={`p-1.5 rounded transition-all ${
              view === 'chart' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'
            }`}
            title="Bar Chart"
          >
            <BarChart className="h-4 w-4" />
          </button>
          <button
            onClick={() => onMaximize({ title, data, nameKey, type })}
            className="p-1.5 rounded transition-all text-gray-500 hover:bg-gray-200"
            title="Maximize Chart"
          >
            <Maximize className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      {view === 'chart' ? (
        <div>
          <div className="px-4 pt-3 pb-2">
            <div className="flex flex-wrap items-center gap-1 bg-gray-100 p-1 rounded-md">
              {metrics.map(metricItem => (
                <button
                  key={metricItem.key}
                  onClick={() => onMetricChange(metricItem.key as MetricKey)}
                  className={`px-2 py-1 text-xs rounded transition-all ${
                    metric === metricItem.key
                      ? 'bg-white text-blue-600 font-semibold shadow-sm'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {metricItem.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ height: '310px' }}>
            <ReactECharts option={getChartOption(data, nameKey, metric)} style={{ height: '100%', width: '100%' }} notMerge={true} lazyUpdate={true} />
          </div>
        </div>
      ) : (
        <SimpleTableView data={data} type={type} onRowClick={onRowClick} />
      )}
    </div>
  );
};

interface PerformersChartsProps {
  zonesData: ZoneData[];
  regionsData: RegionData[];
  districtsData: DistrictData[];
  loading: boolean;
  message: MessageState | null;
  titlePrefix: string;
  onMaximizeChart: (chartInfo: { title: string; data: any[]; nameKey: string; type: 'zones' | 'regions' | 'districts'; }) => void;
  onRegionRowClick: (region: RegionData) => void;
  zoneMetric: MetricKey;
  onZoneMetricChange: (metric: MetricKey) => void;
  regionMetric: MetricKey;
  onRegionMetricChange: (metric: MetricKey) => void;
  districtMetric: MetricKey;
  onDistrictMetricChange: (metric: MetricKey) => void;
  zoneView: ViewType;
  onZoneViewChange: (view: ViewType) => void;
  regionView: ViewType;
  onRegionViewChange: (view: ViewType) => void;
  districtView: ViewType;
  onDistrictViewChange: (view: ViewType) => void;
}

const PerformersCharts: React.FC<PerformersChartsProps> = ({
  zonesData,
  regionsData,
  districtsData,
  loading,
  message,
  titlePrefix,
  onMaximizeChart,
  onRegionRowClick,
  zoneMetric,
  onZoneMetricChange,
  regionMetric,
  onRegionMetricChange,
  districtMetric,
  onDistrictMetricChange,
  zoneView,
  onZoneViewChange,
  regionView,
  onRegionViewChange,
  districtView,
  onDistrictViewChange,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-white rounded-md border shadow-sm">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-600">Loading Chart Data...</span>
      </div>
    );
  }

  if (message && !loading) {
    const noData = !zonesData.length && !regionsData.length && !districtsData.length;
    if (!noData) {
        // If there's a message but also some data, don't show the full-screen message.
    } else {
        return (
          <div className={`mb-4 border rounded-md p-4 flex items-center justify-center h-96 ${
            message.type === 'error' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
          }`}>
            <div className="text-center">
              {message.type === 'error' ? (
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
              ) : (
                <Info className="h-8 w-8 mx-auto mb-2 text-blue-500" />
              )}
              <span className={`font-medium ${message.type === 'error' ? 'text-red-700' : 'text-blue-700'}`}>
                {message.text}
              </span>
            </div>
          </div>
        );
    }
  }

  return ( 
    <div className="space-y-2">
        <ChartWrapper
          title={`${titlePrefix} Performing Zones`}
          icon={<MapPin className="h-4 w-4 text-gray-600 mr-2" />}
          data={zonesData}
          nameKey="zone_name"
          type="zones"
          onMaximize={onMaximizeChart}
          metric={zoneMetric}
          onMetricChange={onZoneMetricChange}
          view={zoneView}
          onViewChange={onZoneViewChange}
        />
        <ChartWrapper
          title={`${titlePrefix} Performing Regions`}
          icon={<Globe className="h-4 w-4 text-gray-600 mr-2" />}
          data={regionsData}
          nameKey="region_name"
          type="regions"
          onMaximize={onMaximizeChart}
          onRowClick={onRegionRowClick}
          metric={regionMetric}
          onMetricChange={onRegionMetricChange}
          view={regionView}
          onViewChange={onRegionViewChange}
        />
      <ChartWrapper
        title={`${titlePrefix} Performing Districts`}
        icon={<Building2 className="h-4 w-4 text-gray-600 mr-2" />}
        data={districtsData}
        nameKey="district_name"
        type="districts"
        onMaximize={onMaximizeChart}
        metric={districtMetric}
        onMetricChange={onDistrictMetricChange}
        view={districtView}
        onViewChange={onDistrictViewChange}
      />
    </div>
  );
};

export default PerformersCharts;