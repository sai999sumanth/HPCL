import React from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Legend, CartesianGrid } from 'recharts';
import { ProcessedHourlyProductionData } from './Types';
import { Loader2, AlertTriangle, BarChart3 } from 'lucide-react';

interface HourlyProductionChartProps {
  data: ProcessedHourlyProductionData;
  loading: boolean;
  error: string | null;
}

/** Same as Bottling Summary chart */
const COLORS = ['#1a80bb', '#ea801c', '#14b8a6'];

const todayDate = new Date().toLocaleDateString('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-300 rounded shadow-lg text-sm">
        <p className="font-semibold text-gray-800 mb-2">Time: {label}</p>
        {payload.map((p, index) => (
          <div key={index} style={{ color: p.color }} className="flex justify-between space-x-4">
            <span>{p.name}:</span>
            <span className="font-bold">{p.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const BarLabel = (props: any) => {
  const { x, y, width, value } = props;
  if (value === 0) return null;
  return (
    <text x={x + width / 2} y={y} fill="#1b3b85ff" textAnchor="middle" dy={0} fontSize={10} >
      {value.toLocaleString()}
    </text>
  );
};

/** Custom X-axis tick with rotation so labels don't overlap */
const CustomXAxisTick = (props: { x?: number; y?: number; payload?: { value?: string } }) => {
  const { x = 0, y = 0, payload } = props;
  const text = payload?.value ?? '';
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        fontSize={10}
        fill="#888888"
        textAnchor="end"
        transform="rotate(-15)"
        dy={4}
      >
        {text}
      </text>
    </g>
  );
};

export const HourlyProductionChart: React.FC<HourlyProductionChartProps> = ({ data, loading, error }) => {
  const { chartData, carouselKeys, carouselTotals } = data;

  const hasData = !loading && !error && chartData.length > 0;

  // Format timeSlot labels from "0600 - 0700" to "06:00 - 07:00"
  const formattedChartData = chartData.map((item: any) => {
    if (!item || !item.timeSlot || typeof item.timeSlot !== 'string') return item;
    const formatted = item.timeSlot.replace(/(\d{2})(\d{2})/g, '$1:$2');
    return { ...item, timeSlot: formatted };
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 h-full flex flex-col min-h-0"
    >
      <div className="flex justify-between items-start gap-4 mb-2 flex-shrink-0">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Day's Production</h3>
          <p className="text-xs text-gray-500">{todayDate}</p>
        </div>
        {hasData && (
        <div className="text-right">
          <div className="text-sm text-gray-500 font-medium">TOTAL FILLING</div>
          <div className="flex items-center justify-end gap-4 mt-0.5">
            {carouselTotals.map((item, index) => (
              <div key={item.carouselName} className="flex items-center gap-4">
                {index > 0 && <div className="w-px h-8 bg-gray-200" />}
                <div className="flex flex-col items-end">
                  <p className="text-xl font-bold text-blue-600">{item.total.toLocaleString()} cyls</p>
                  <p className="text-xs text-gray-500">{item.carouselName}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center">
        {loading ? (
          <div className="text-center text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
            <p>Loading Production Data...</p>
          </div>
        ) : error || chartData.length === 0 ? (
          <div className="text-center text-gray-400">
            <BarChart3 className="w-10 h-10 mx-auto mb-2" />
            <p>{error || 'No hourly production data for this period.'}</p>
          </div>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={formattedChartData} margin={{ top: 5, right: 20, left: -10, bottom: 28 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="timeSlot"
              stroke="#888888"
              tick={<CustomXAxisTick />}
              tickLine={false}
              axisLine={false}
              interval={0}
            />
            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(243, 244, 246, 0.5)' }} />
            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
            {carouselKeys.map((key, index) => (
              <Bar key={key} dataKey={key} fill={COLORS[index % COLORS.length]} barSize={20} radius={[4, 4, 0, 0]}>
                <LabelList dataKey={key} content={<BarLabel />} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
};
