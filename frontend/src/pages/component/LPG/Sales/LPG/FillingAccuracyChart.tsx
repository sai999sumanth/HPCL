import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { FillingAccuracyData } from './Types';
import { Loader2, AlertTriangle, CheckCircle2, BarChart3 } from 'lucide-react';

// THE FIX: The color palette has been updated to match the provided image.
const ACCURACY_COLORS = {
  '0 grams': '#4DB6AC',        // Teal from image
  '0 - 50 grams': '#FFB74D',   // Light Orange from image
  '50-100 grams': '#F57C00',  // Dark Orange from image
  '100+ grams': '#D32F2F',     // Red from image
};

// This component is for the single-chart view with the legend on the right.
const SingleChartWithRightLegend: React.FC<{ systemData: FillingAccuracyData }> = ({ systemData }) => {
  const [hiddenSeries, setHiddenSeries] = useState<string[]>([]);

  const toggleSeries = (dataKey: string) => {
    setHiddenSeries(prev =>
      prev.includes(dataKey) ? prev.filter(s => s !== dataKey) : [...prev, dataKey]
    );
  };

  const chartData = [
    { name: '0 grams', value: systemData.breakdown.on_target, color: ACCURACY_COLORS['0 grams'] },
    { name: '0 - 50 grams', value: systemData.breakdown.var_0_50, color: ACCURACY_COLORS['0 - 50 grams'] },
    { name: '50-100 grams', value: systemData.breakdown.var_50_100, color: ACCURACY_COLORS['50-100 grams'] },
    { name: '100+ grams', value: systemData.breakdown.var_100_plus, color: ACCURACY_COLORS['100+ grams'] },
  ].filter(item => item.value > 0);

  const visibleData = chartData.filter(item => !hiddenSeries.includes(item.name));
  const totalVisible = visibleData.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const percentage = totalVisible > 0 ? ((data.value / totalVisible) * 100).toFixed(2) : 0;
      return (
        <div className="bg-white p-2 border border-gray-300 rounded shadow-lg text-xs z-50 relative">
          <div className="flex items-center mb-1">
            <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: data.payload.fill }}></span>
            <p className="font-semibold text-gray-800">{data.name}</p>
          </div>
          <p className="text-gray-600">Count: <span className="font-bold">{data.value.toLocaleString()}</span></p>
          <p className="text-gray-600">Percentage: <span className="font-bold">{percentage}%</span></p>
        </div>
      );
    }
    return null;
  };

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null;
    
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="w-full h-full flex flex-col md:flex-row items-center gap-2 min-w-0">
      <div className="w-full md:flex-1 min-w-0 h-52 relative outline-none [&_*]:outline-none [&_*:focus]:outline-none select-none" tabIndex={-1} style={{ outline: 'none' }} onMouseDown={(e) => e.preventDefault()}>
        <ResponsiveContainer width="100%" height="100%" style={{ outline: 'none' }}>
          <PieChart style={{ outline: 'none' }}>
            <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 1000 }} />
            <Pie data={visibleData} cx="50%" cy="50%" label={renderCustomizedLabel} labelLine={false} outerRadius={90} innerRadius={52} paddingAngle={2} dataKey="value" strokeWidth={2} stroke="#fff" activeIndex={-1}>
              {visibleData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-gray-700">Carousel</span>
          <span className="text-lg font-semibold text-gray-600">{systemData.systemId}</span>
        </div>
      </div>
      <div className="w-full md:flex-1 min-w-0">
        <ul className="space-y-1">
          {chartData.map((item) => {
            const isHidden = hiddenSeries.includes(item.name);
            return (
              <li
                key={item.name}
                onClick={() => toggleSeries(item.name)}
                className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${isHidden ? 'bg-gray-100 text-gray-400' : 'hover:bg-gray-50'}`}
              >
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: isHidden ? '#d1d5db' : item.color }}></span>
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <span className="text-sm font-bold">{item.value.toLocaleString()}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

// This is the component for a single chart in the multi-view grid.
const SingleAccuracyChart: React.FC<{ systemData: FillingAccuracyData; hiddenSeries: string[] }> = ({ systemData, hiddenSeries }) => {
  const chartData = [
    { name: '0 grams', value: systemData.breakdown.on_target, color: ACCURACY_COLORS['0 grams'] },
    { name: '0 - 50 grams', value: systemData.breakdown.var_0_50, color: ACCURACY_COLORS['0 - 50 grams'] },
    { name: '50-100 grams', value: systemData.breakdown.var_50_100, color: ACCURACY_COLORS['50-100 grams'] },
    { name: '100+ grams', value: systemData.breakdown.var_100_plus, color: ACCURACY_COLORS['100+ grams'] },
  ].filter(item => item.value > 0);

  const visibleData = chartData.filter(item => !hiddenSeries.includes(item.name));
  const totalVisible = visibleData.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const percentage = totalVisible > 0 ? ((data.value / totalVisible) * 100).toFixed(2) : 0;
      return (
        <div className="bg-white p-2 border border-gray-300 rounded shadow-lg text-xs z-50 relative">
          <div className="flex items-center mb-1">
            <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: data.payload.fill }}></span>
            <p className="font-semibold text-gray-800">{data.name}</p>
          </div>
          <p className="text-gray-600">Count: <span className="font-bold">{data.value.toLocaleString()}</span></p>
          <p className="text-gray-600">Percentage: <span className="font-bold">{percentage}%</span></p>
        </div>
      );
    }
    return null;
  };

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null;
    
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="w-full h-full rounded-lg px-1 py-1 flex flex-col bg-gray-50/50 min-w-0">
      <div className="flex justify-between items-start mb-0.5">
        <div className="text-left">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-lg font-bold text-gray-800">{systemData.total_filled.toLocaleString()}</p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-green-600">{systemData.accuracy_rate.toFixed(2)}%</div>
          <p className="text-xs text-gray-500">Accuracy</p>
        </div>
      </div>
      <div className="flex-grow h-44 relative min-h-0 outline-none [&_*]:outline-none [&_*:focus]:outline-none select-none" tabIndex={-1} style={{ outline: 'none' }} onMouseDown={(e) => e.preventDefault()}>
        <ResponsiveContainer width="100%" height="100%" style={{ outline: 'none' }}>
          <PieChart style={{ outline: 'none' }}>
            <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 1000 }} />
            <Pie data={visibleData} cx="50%" cy="50%" label={renderCustomizedLabel} labelLine={false} outerRadius={70} innerRadius={42} paddingAngle={2} dataKey="value" strokeWidth={2} stroke="#fff" activeIndex={-1}>
              {visibleData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none -translate-y-2">
          <span className="text-base font-bold text-gray-700">Carousel</span>
          <span className="text-sm font-semibold text-gray-600">{systemData.systemId}</span>
        </div>
      </div>
    </div>
  );
};

interface FillingAccuracyChartProps {
  data: FillingAccuracyData[];
  loading: boolean;
  error: string | null;
}

export const FillingAccuracyChart: React.FC<FillingAccuracyChartProps> = ({ data, loading, error }) => {
  const [hiddenSeries, setHiddenSeries] = useState<string[]>([]);

  const toggleSeries = (dataKey: string) => {
    setHiddenSeries(prev =>
      prev.includes(dataKey) ? prev.filter(s => s !== dataKey) : [...prev, dataKey]
    );
  };

  const legendItems = [
    { name: '0 grams', color: ACCURACY_COLORS['0 grams'] },
    { name: '0 - 50 grams', color: ACCURACY_COLORS['0 - 50 grams'] },
    { name: '50-100 grams', color: ACCURACY_COLORS['50-100 grams'] },
    { name: '100+ grams', color: ACCURACY_COLORS['100+ grams'] },
  ];

  const chartCount = data?.length ?? 0;
  const gridCols = chartCount === 2 ? 'sm:grid-cols-2' : chartCount === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2 xl:grid-cols-3';
  const hasData = !loading && !error && chartCount > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full h-full flex flex-col min-h-0 bg-white rounded-xl shadow-lg border border-gray-100 p-3"
    >
      <div className="flex justify-between items-center mb-2 flex-shrink-0">
        <h3 className="text-base font-semibold text-gray-900">Filling Accuracy</h3>
        {hasData && chartCount === 1 && (
          <div className="flex items-end gap-8 whitespace-nowrap text-right">
            <div>
              <p className="text-[10px] text-gray-500">Accuracy</p>
              <p className="text-lg font-bold text-green-600">{data[0].accuracy_rate.toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500">Total Filled</p>
              <p className="text-lg font-bold text-gray-800">{data[0].total_filled.toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>
      <div className="flex-grow min-h-0 overflow-hidden flex flex-col w-full">
        {loading ? (
          <div className="flex items-center justify-center flex-1 text-gray-500">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p>Loading Accuracy Data...</p>
            </div>
          </div>
        ) : error || !data || data.length === 0 ? (
          <div className="flex items-center justify-center flex-1 text-gray-400">
            <div className="text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2" />
              <p>{error || 'No filling data available.'}</p>
            </div>
          </div>
        ) : chartCount === 1 ? (
          <div className="w-full flex-1 min-h-0">
            <SingleChartWithRightLegend systemData={data[0]} />
          </div>
        ) : (
          <div className="flex flex-col h-full min-h-0 w-full">
            <div className={`grid w-full grid-cols-1 ${gridCols} gap-2 flex-grow min-h-0`}>
              {data.map((systemData) => (
                <div key={systemData.systemId} className="h-full min-h-[100px] w-full min-w-0">
                  <SingleAccuracyChart systemData={systemData} hiddenSeries={hiddenSeries} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex-shrink-0 px-0">
              <ul className="flex justify-center items-center gap-x-4 gap-y-1 flex-wrap text-xs">
                {legendItems.map((item) => {
                  const isHidden = hiddenSeries.includes(item.name);
                  return (
                    <li
                      key={item.name}
                      onClick={() => toggleSeries(item.name)}
                      className={`flex items-center cursor-pointer transition-colors ${isHidden ? 'text-gray-400' : 'text-gray-700'}`}
                    >
                      <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: isHidden ? '#d1d5db' : item.color }}></span>
                      {item.name}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

