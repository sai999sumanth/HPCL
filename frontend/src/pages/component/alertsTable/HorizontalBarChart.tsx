import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export interface DataPoint {
  date: string;
  Gondor: number;
  Hobbiton: number;
  Mordor: number;
  Rohan: number;
}

interface HorizontalStackedBarChartProps {
  data: DataPoint[];
  height?: number;
}

const HorizontalStackedBarChart: React.FC<HorizontalStackedBarChartProps> = ({ data, height = 350 }) => {
  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#22c55e', '#f43f5e', '#fbbf24', '#06b6d4', '#6366f1'];

  // Custom Tooltip Component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-300 p-4 shadow-lg rounded-md">
          <p className="font-bold mb-2">{`Date: ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center mb-1">
              <div 
                className="w-[10px] h-[10px] mr-2 " 
                style={{ 
                  backgroundColor: colors[index]
                }}
              />
              <span className="mr-2">{entry.dataKey}:</span>
              <span className="font-semibold">{entry.value.toFixed(2)} USD</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          layout="vertical" // Horizontal bars
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <defs>
            {colors.map((color, index) => (
              <linearGradient 
                key={`gradient-${index}`} 
                id={`gradient-${index}`} 
                x1="0" 
                y1="0" 
                x2="0" 
                y2="1"
              >
                <stop offset="0%" stopColor={color} stopOpacity={1} />
                <stop offset="100%" stopColor={color} stopOpacity={0.7} />
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            tickFormatter={(value) => (value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value)}
          />
          <YAxis dataKey="date" type="category" />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="Gondor" stackId="a" fill={`url(#gradient-0)`} />
          <Bar dataKey="Hobbiton" stackId="a" fill={`url(#gradient-1)`} />
          <Bar dataKey="Mordor" stackId="a" fill={`url(#gradient-2)`} />
          <Bar dataKey="Rohan" stackId="a" fill={`url(#gradient-3)`} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default HorizontalStackedBarChart;