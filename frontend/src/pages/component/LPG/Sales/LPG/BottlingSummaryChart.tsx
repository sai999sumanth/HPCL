import React from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Legend } from 'recharts';
import { ProcessedBottlingData } from './Types';
import { Loader2, AlertTriangle, PackageCheck } from 'lucide-react';

interface BottlingSummaryChartProps {
  data: ProcessedBottlingData;
  loading: boolean;
  error: string | null;
}

const COLORS = ['#1a80bb', '#ea801c', '#14b8a6'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-300 rounded shadow-lg text-sm">
        <p className="font-semibold text-gray-800 mb-2">{label}</p>
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

export const BottlingSummaryChart: React.FC<BottlingSummaryChartProps> = ({ data, loading, error }) => {
  const { chartData, carouselKeys } = data;

  const isNoData = error ||
    (typeof error === "string" && error.includes("No data found")) ||
    (error && typeof error === "object" && Object.keys(error).length === 0) ||
    chartData.length === 0;
  const hasData = !loading && !isNoData;
  const totalProduction = hasData ? chartData.reduce((total, item) => {
    let itemTotal = 0;
    carouselKeys.forEach(key => {
        itemTotal += (item[key] as number) || 0;
    });
    return total + itemTotal;
  }, 0) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 h-full flex flex-col"
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Bottling Summary</h3>
        </div>
        {hasData && (
        <div className="text-right">
          <p className="text-xs text-gray-500">Total Production</p>
          <p className="text-2xl font-bold text-gray-800">{totalProduction.toLocaleString()}</p>
        </div>
        )}
      </div>
      <div className="flex-grow flex items-center justify-center">
        {loading ? (
          <div className="text-center text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
            <p>Loading Summary...</p>
          </div>
        ) : isNoData ? (
          <div className="text-center text-gray-400">
            <PackageCheck className="w-10 h-10 mx-auto mb-2" />
            <p>{typeof error === 'string' ? error : 'No bottling data for this period.'}</p>
          </div>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
            <XAxis
              dataKey="name"
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              interval={0}
            />
            <YAxis stroke="#888888" fontSize={12} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(243, 244, 246, 0.5)' }} />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
            {carouselKeys.map((key, index) => (
              <Bar key={key} dataKey={key} fill={COLORS[index % COLORS.length]} barSize={20} radius={[4, 4, 0, 0]}>
                <LabelList 
                  dataKey={key} 
                  position="top" 
                  style={{ fontSize: '10px', fill: '#4b5563' }} 
                  formatter={(value: number) => value > 0 ? value.toLocaleString() : ''} 
                />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
};
