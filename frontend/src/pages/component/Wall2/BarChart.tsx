import React from 'react';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface DataPoint {
  date: string;
  value: number;
}

const PerformanceChart: React.FC = () => {
  const data: DataPoint[] = [
    { date: 'Jan 2024', value: 4700 },
    { date: 'Feb 2024', value: 4700 },
    { date: 'Mar 2024', value: 3200 },
    { date: 'Apr 2024', value: 2000 },
    { date: 'May 2024', value: 4500 },
    { date: 'Jun 2024', value: 5000 },
    { date: 'Jul 2024', value: 4500 }
  ];

  return (
    <div style={{ width: '100%', height: '400px' }}>
      <ResponsiveContainer>
        <RechartsBarChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis 
            label={{ 
              value: 'Value ($)', 
              angle: -90, 
              position: 'insideLeft' 
            }}
          />
          <Tooltip 
            formatter={(value: number) => [`$${value}`, 'Value']}
          />
          <Legend />
          <Bar 
            dataKey="value" 
            fill="#8884d8"
            name="Monthly Value"
          />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PerformanceChart;