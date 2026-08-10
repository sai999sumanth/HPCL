import React from 'react';
import ReactECharts from 'echarts-for-react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/@/lib/utils';

interface InstanceData {
  instance_level: string;
  count: number;
}

interface ItdgActionableChartProps {
  data: InstanceData[] | null;
  loading: boolean;
  error: boolean;
  className?: string;
}

const ItdgActionableChart: React.FC<ItdgActionableChartProps> = ({ data, loading, error, className }) => {
  if (loading) {
    return (
      <div className={cn("bg-white rounded-lg p-3 shadow-sm border border-gray-200 h-full flex items-center justify-center", className)}>
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !data || data.length === 0) {
    return (
      <div className={cn("bg-white rounded-lg p-3 shadow-sm border border-gray-200 h-full flex flex-col", className)}>
        <div className="w-full flex flex-col justify-center pr-2">
            <h4 className="font-bold text-gray-800 text-base mb-2">ITDG Actionable</h4>
        </div>
        <div className="flex-grow flex items-center justify-center text-sm text-gray-500">
          Data unavailable
        </div>
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.count, 0);
  const chartData = data.map(item => ({
    name: item.instance_level.replace('Instance - ', 'Instance '),
    value: item.count
  }));

  const colorPalette = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'];

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
      backgroundColor: 'rgba(255,255,255,0.9)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#333' },
      padding: [8, 12],
      extraCssText: 'border-radius: 8px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);'
    },
    series: [
      {
        name: 'ITDG Actionable',
        type: 'pie',
        radius: ['60%', '85%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: { show: false },
        emphasis: { scaleSize: 8 },
        data: chartData,
        color: colorPalette,
      },
    ],
    graphic: {
      type: 'group',
      left: 'center',
      top: 'center',
      children: [
        {
          type: 'text',
          style: {
            text: total.toLocaleString(),
            textAlign: 'center',
            fill: '#1f2937',
            fontSize: 14,
            fontWeight: 'bold',
          },
        },
        {
          type: 'text',
          top: 18,
          style: {
            text: 'Total',
            textAlign: 'center',
            fill: '#6b7280',
            fontSize: 10,
          },
        },
      ],
    },
  };

  return (
    <div className={cn(
        "bg-white rounded-lg pl-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 border border-red-400 h-full flex items-center",
        className
    )}>
      {/* Left Half: Title and Legend */}
      <div className="w-1/2 flex flex-col justify-center p-2">
        <h4 className="font-bold text-gray-800 text-base mb-2">ITDG Actionable</h4>
        <div className="space-y-1">
          {chartData.map((item, index) => (
            <div key={item.name} className="flex items-center  text-xs">
              <div className="flex items-center truncate mr-8">
                <span
                  className="w-2 h-2 rounded-full mr-2 flex-shrink-0"
                  style={{ backgroundColor: colorPalette[index % colorPalette.length] }}
                ></span>
                <span className="text-gray-600 truncate" title={item.name}>{item.name}</span>
              </div>
              <span className="font-semibold text-gray-800">{item.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Half: Chart */}
      <div className="w-1/2 h-full">
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} notMerge={true} />
      </div>
    </div>
  );
};

export default ItdgActionableChart;
