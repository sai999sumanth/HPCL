import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { SingleCSRejectionData } from './Types';
import { Loader2, AlertTriangle, BarChart3, PackageCheck } from 'lucide-react';

// THE FIX: The color palette has been updated with darker, richer tones.
const REJECTION_COLORS = {
  'Other Errors': '#1E2A4A',     // Darker Blue
  'Timeout': '#4B3B73',          // Darker Purple
  'Overfilled': '#9E3E6E',       // Darker Magenta
  'Underfilled': '#D05C76',     // Darker Salmon Pink
  'Negative Tare': '#E58F45',    // Darker Orange
  'Positive Tare': '#E5B947',    // Darker Yellow/Gold
  'Comm Error': '#6C7879',       // Darker Grey
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    const percentage = data.payload.percentage ?? 0;
    return (
      <div className="bg-white p-2 border border-gray-300 rounded shadow-lg text-xs z-50 relative">
        <div className="flex items-center mb-1">
          <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: data.payload.fill }}></span>
          <p className="font-semibold text-gray-800">{data.name}</p>
        </div>
        <p className="text-gray-600">Count: <span className="font-bold">{data.value.toLocaleString()}</span></p>
        <p className="text-gray-600">Percentage: <span className="font-bold">{percentage.toFixed(2)}%</span></p>
      </div>
    );
  }
  return null;
};

const LEGEND_ITEMS = [
  { name: 'Other Errors', color: REJECTION_COLORS['Other Errors'] },
  { name: 'Timeout', color: REJECTION_COLORS['Timeout'] },
  { name: 'Overfilled', color: REJECTION_COLORS['Overfilled'] },
  { name: 'Underfilled', color: REJECTION_COLORS['Underfilled'] },
  { name: 'Negative Tare', color: REJECTION_COLORS['Negative Tare'] },
  { name: 'Positive Tare', color: REJECTION_COLORS['Positive Tare'] },
  { name: 'Comm Error', color: REJECTION_COLORS['Comm Error'] },
];

const addPercentages = (items: Array<{ name: string; value: number; color: string }>) => {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return items.map(item => ({
    ...item,
    percentage: total > 0 ? (item.value / total) * 100 : 0,
  }));
};

// Single-chart view: donut with legend only at the bottom.
const SingleChartWithBottomLegend: React.FC<{ carouselData: SingleCSRejectionData }> = ({ carouselData }) => {
  const [hiddenSeries, setHiddenSeries] = useState<string[]>([]);

  const toggleSeries = (dataKey: string) => {
    setHiddenSeries(prev =>
      prev.includes(dataKey) ? prev.filter(s => s !== dataKey) : [...prev, dataKey]
    );
  };

  const breakdown = [
    { name: 'Other Errors', value: carouselData.other_errors, color: REJECTION_COLORS['Other Errors'] },
    { name: 'Timeout', value: carouselData.timeout, color: REJECTION_COLORS['Timeout'] },
    { name: 'Overfilled', value: carouselData.overfilled, color: REJECTION_COLORS['Overfilled'] },
    { name: 'Underfilled', value: carouselData.underfilled, color: REJECTION_COLORS['Underfilled'] },
    { name: 'Negative Tare', value: carouselData.negative_tare, color: REJECTION_COLORS['Negative Tare'] },
    { name: 'Positive Tare', value: carouselData.positive_tare, color: REJECTION_COLORS['Positive Tare'] },
    { name: 'Comm Error', value: carouselData.commErrorSortout, color: REJECTION_COLORS['Comm Error'] },
  ].filter(item => item.value > 0);

  const visibleData = addPercentages(breakdown.filter(item => !hiddenSeries.includes(item.name)));

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
    <div className="w-full h-full flex flex-col">
      <div className="flex-grow flex items-center justify-center min-h-0">
        <div className="w-full max-w-xs h-52 relative outline-none [&_*]:outline-none [&_*:focus]:outline-none select-none" style={{ outline: 'none' }} onMouseDown={(e) => e.preventDefault()}>
          <ResponsiveContainer width="100%" height="100%" style={{ outline: 'none' }}>
            <PieChart style={{ outline: 'none' }}>
              <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 1000 }} />
              <Pie data={visibleData} cx="50%" cy="50%" label={renderCustomizedLabel} labelLine={false} outerRadius={90} innerRadius={52} paddingAngle={2} dataKey="value" strokeWidth={2} stroke="#fff" activeIndex={-1}>
                {visibleData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-base font-bold text-gray-700">Carousel</span>
            <span className="text-sm font-semibold text-gray-600">{carouselData.carouselId}</span>
          </div>
        </div>
      </div>
      <div className="mt-1 flex-shrink-0 px-1 w-full min-w-0">
        <ul className="flex justify-center items-center gap-x-3 sm:gap-x-4 gap-y-1.5 flex-wrap text-[11px] max-w-full">
          {LEGEND_ITEMS.map((item) => {
            const isHidden = hiddenSeries.includes(item.name);
            return (
              <li
                key={item.name}
                onClick={() => toggleSeries(item.name)}
                className={`flex items-center cursor-pointer transition-colors flex-shrink-0 ${isHidden ? 'text-gray-400' : 'text-gray-700'}`}
              >
                <span className="w-2.5 h-2.5 rounded-full mr-1.5 flex-shrink-0" style={{ backgroundColor: isHidden ? '#d1d5db' : item.color }}></span>
                <span className="truncate">{item.name}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

// This is the component for a single chart in the multi-view grid.
const SingleRejectionDonutChart: React.FC<{ carouselData: SingleCSRejectionData; hiddenSeries: string[] }> = ({ carouselData, hiddenSeries }) => {
  const breakdown = [
    { name: 'Other Errors', value: carouselData.other_errors, color: REJECTION_COLORS['Other Errors'] },
    { name: 'Timeout', value: carouselData.timeout, color: REJECTION_COLORS['Timeout'] },
    { name: 'Overfilled', value: carouselData.overfilled, color: REJECTION_COLORS['Overfilled'] },
    { name: 'Underfilled', value: carouselData.underfilled, color: REJECTION_COLORS['Underfilled'] },
    { name: 'Negative Tare', value: carouselData.negative_tare, color: REJECTION_COLORS['Negative Tare'] },
    { name: 'Positive Tare', value: carouselData.positive_tare, color: REJECTION_COLORS['Positive Tare'] },
    { name: 'Comm Error', value: carouselData.commErrorSortout, color: REJECTION_COLORS['Comm Error'] },
  ].filter(item => item.value > 0);

  const visibleData = addPercentages(breakdown.filter(item => !hiddenSeries.includes(item.name)));

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
    <div className="w-full h-full rounded-lg p-2 flex flex-col bg-gray-50/50">
      <div className="flex justify-between items-start mb-1">
        <div className="text-left">
          <p className="text-xs text-gray-500">Total Rejections</p>
          <p className="text-lg font-bold text-gray-800">{carouselData.sortout.toLocaleString()}</p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-red-600">{carouselData.rejection_rate.toFixed(2)}%</div>
          <p className="text-xs text-gray-500">Rejection Rate</p>
        </div>
      </div>
      <div className="flex-grow h-60 relative outline-none [&_*]:outline-none [&_*:focus]:outline-none select-none" tabIndex={-1} style={{ outline: 'none' }} onMouseDown={(e) => e.preventDefault()}>
        <ResponsiveContainer width="100%" height="100%" style={{ outline: 'none' }}>
          <PieChart style={{ outline: 'none' }}>
            <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 1000 }} />
            <Pie data={visibleData} cx="50%" cy="50%" label={renderCustomizedLabel} labelLine={false} outerRadius={90} innerRadius={55} paddingAngle={2} dataKey="value" strokeWidth={2} stroke="#fff" activeIndex={-1}>
              {visibleData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none -translate-y-2">
          <span className="text-base font-bold text-gray-700">Carousel</span>
          <span className="text-sm font-semibold text-gray-600">{carouselData.carouselId}</span>
        </div>
      </div>
    </div>
  );
};

interface CSRejectionChartProps {
  data: SingleCSRejectionData[];
  loading: boolean;
  error: string | null;
}

const CSRejectionChart: React.FC<CSRejectionChartProps> = ({ data, loading, error }) => {
  const [hiddenSeries, setHiddenSeries] = useState<string[]>([]);

  const toggleSeries = (dataKey: string) => {
    setHiddenSeries(prev =>
      prev.includes(dataKey) ? prev.filter(s => s !== dataKey) : [...prev, dataKey]
    );
  };

  const chartCount = data?.length ?? 0;
  const gridCols = chartCount === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3';
  const hasData = !loading && !error && chartCount > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full h-full flex flex-col min-h-0 bg-white rounded-xl shadow-lg border border-gray-100 p-6"
    >
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h3 className="text-lg font-semibold text-gray-900">Check Scale Rejection Analysis</h3>
        {hasData && chartCount === 1 && (
          <div className="flex items-end gap-8 whitespace-nowrap text-right">
            <div>
              <p className="text-xs text-gray-500">Rejection Rate</p>
              <p className="text-xl font-bold text-red-600">{data[0].rejection_rate.toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Rejections</p>
              <p className="text-xl font-bold text-gray-800">{data[0].sortout.toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>
      <div className="flex-grow min-h-0 overflow-hidden flex items-center justify-center">
        {loading ? (
          <div className="text-center text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
            <p>Loading Rejection Data...</p>
          </div>
        ) : error || !data || data.length === 0 ? (
          <div className="text-center text-gray-400">
            <BarChart3 className="w-10 h-10 mx-auto mb-2" />
            <p>{error || 'No CS Rejection data for this period.'}</p>
          </div>
        ) : chartCount === 1 ? (
          <SingleChartWithBottomLegend carouselData={data[0]} />
        ) : (
          <div className="flex flex-col h-full min-h-0 overflow-hidden">
            <div className={`grid grid-cols-1 ${gridCols} gap-4 flex-grow min-h-0`}>
              {data.map((carouselData) => (
                <div key={carouselData.carouselId} className="h-full min-h-[100px]">
                  <SingleRejectionDonutChart carouselData={carouselData} hiddenSeries={hiddenSeries} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex-shrink-0 px-1 w-full min-w-0">
              <ul className="flex justify-center items-center gap-x-3 sm:gap-x-4 gap-y-1.5 flex-wrap text-[11px] max-w-full">
                {LEGEND_ITEMS.map((item) => {
                  const isHidden = hiddenSeries.includes(item.name);
                  return (
                    <li
                      key={item.name}
                      onClick={() => toggleSeries(item.name)}
                      className={`flex items-center cursor-pointer transition-colors flex-shrink-0 ${isHidden ? 'text-gray-400' : 'text-gray-700'}`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full mr-1.5 flex-shrink-0" style={{ backgroundColor: isHidden ? '#d1d5db' : item.color }}></span>
                      <span className="truncate">{item.name}</span>
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

export default CSRejectionChart;
