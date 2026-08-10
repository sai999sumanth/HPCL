import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { cn } from '@/@/lib/utils';
import { apiClient } from '@/services/apiClient';
import { Loader2 } from 'lucide-react';

type HeatmapView = 'zone' | 'plant';
type QueryType = 'product_safety' | 'trip_safety';

interface ZoneViolationHeatmapProps {
  selectedBu: string;
  queryType: QueryType;
}

const ZoneViolationHeatmap: React.FC<ZoneViolationHeatmapProps> = ({ selectedBu, queryType }) => {
  const [chartOption, setChartOption] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<HeatmapView>('zone');

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedBu) return;

      setLoading(true);
      setError(null);
      try {
        const drillStateValue = view === 'zone' ? 'zone' : 'Location';
        const payload = {
          filters: [{ key: "bu", cond: "equals", value: selectedBu }],
          action: "location_level_voilation_breakup",
          drill_state: drillStateValue,
          cross_filters: [],
          payload: { "query_type": queryType }
        };
        const response = await apiClient.post('/api/charts/generate_vis_data', payload);

        if (response.data && response.data.status) {
          const apiData = response.data.data;

          const locations = Object.keys(apiData);
          const violationTypesSet = new Set<string>();
          Object.values(apiData).forEach((violationsArray: any[]) => {
            if (Array.isArray(violationsArray)) {
              violationsArray.forEach(violation => {
                if (violation.violation_type) {
                  violationTypesSet.add(violation.violation_type);
                }
              });
            }
          });
          const violations = Array.from(violationTypesSet).sort();

          const data = [];
          let maxValue = 0;

          locations.forEach((location, xIndex) => {
            violations.forEach((violation, yIndex) => {
              const locationViolations = apiData[location] || [];
              const violationData = locationViolations.find((v: any) => v.violation_type === violation);
              const count = violationData ? violationData.count : 0;

              if (count > maxValue) {
                maxValue = count;
              }
              
              data.push([xIndex, yIndex, count]);
            });
          });

          const showDataZoom = view === 'plant' && locations.length > 15;

          const option = {
            grid: { top: '5%', left: '20%', right: '5%', bottom: showDataZoom ? '30%' : '25%' },
            tooltip: {
              position: 'top',
              formatter: (params: any) => {
                if (params.data) {
                  return `<strong>${locations[params.data[0]]}</strong><br/>${violations[params.data[1]]}: ${params.data[2]}`;
                }
                return '';
              },
            },
            xAxis: {
              type: 'category',
              data: locations,
              splitArea: { show: true },
              axisLine: { show: false },
              axisTick: { show: false },
              axisLabel: {
                rotate: 45,
                interval: 0,
                fontSize: 10,
              }
            },
            yAxis: {
              type: 'category',
              data: violations,
              splitArea: { show: true },
              axisLine: { show: false },
              axisTick: { show: false },
              axisLabel: {
                fontSize: 10,
              }
            },
            visualMap: {
              min: 0,
              max: maxValue > 0 ? maxValue : 50,
              calculable: false,
              orient: 'horizontal',
              show: false,
              pieces: [
                { gte: 21, color: '#c0392b' }, // Critical
                { gte: 12, lte: 20, color: '#f39c12' }, // High
                { lte: 11, color: '#27ae60' }, // Low
                { value: 0, color: '#ecf0f1' } // No Alerts
              ],
            },
            series: [{
              name: 'Violations',
              type: 'heatmap',
              data: data,
              label: { show: true, color: '#000', fontWeight: 'bold', fontSize: 10 },
              itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
              emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' } },
            }],
            dataZoom: showDataZoom ? [
              {
                type: 'slider',
                xAxisIndex: 0,
                filterMode: 'filter',
                start: 0,
                end: (15 / locations.length) * 100,
                bottom: '8%',
                height: 20,
                showDataShadow: false,
              }
            ] : [],
          };
          setChartOption(option);
        } else {
          throw new Error(response.data?.message || "Invalid data structure from API.");
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch chart data.');
        console.error("API Error:", err);
        setChartOption(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedBu, view, queryType]);

  const legendItems = [
    { name: 'No Alerts', color: 'bg-gray-200' },
    { name: 'Low', color: 'bg-green-500' },
    { name: 'High', color: 'bg-orange-400' },
    { name: 'Critical', color: 'bg-red-600' },
  ];
  
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          <p className="mt-2 text-sm text-gray-500">Loading Chart Data...</p>
        </div>
      );
    }

    if (error || !chartOption) {
      return (
        <div className="flex flex-col items-center justify-center h-[400px] text-center">
          <div className="text-gray-500 mb-2">⚠️</div>
          <p className="text-gray-600 text-sm">No data</p>
          <p className="text-gray-500 text-xs">Please try again later.</p>
        </div>
      );
    }

    return <ReactECharts option={chartOption} style={{ height: '450px' }} notMerge={true} />;
  }

  return (
    <div className="bg-white p-2">
      <div className="flex justify-between items-center mb-2 px-2">
        <h3 className="text-base font-bold text-gray-800">
          {view === 'zone' ? 'Zone-Violation Heat Map' : 'Plant-Violation Heat Map'}
        </h3>
        <div className="flex items-center bg-gray-100 rounded-full p-1">
            <button
                onClick={() => setView('zone')}
                className={cn(
                    'text-xs font-semibold px-3 py-1 rounded-full transition-colors duration-200',
                    view === 'zone' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-200'
                )}
            >
                Zone
            </button>
            <button
                onClick={() => setView('plant')}
                className={cn(
                    'text-xs font-semibold px-3 py-1 rounded-full transition-colors duration-200',
                    view === 'plant' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-200'
                )}
            >
                Plant
            </button>
        </div>
      </div>
      {renderContent()}
      <div className="flex justify-center items-center space-x-4 mt-4 text-xs text-gray-600">
        {legendItems.map(item => (
          <div key={item.name} className="flex items-center">
            <div className={cn('w-4 h-4 rounded-sm mr-2', item.color)}></div>
            <span>{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ZoneViolationHeatmap;
