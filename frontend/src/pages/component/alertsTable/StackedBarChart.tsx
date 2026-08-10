import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { fetchTerminalData } from '../RetailTerminalHome/ApiServiceFile'; // Adjust import path as needed

// Updated interface to match the API response
interface AlertAgeingData {
  alert_ageing: string;
  alert_count: number;
}

interface StackedBarChartProps {
  bu: string;
  height?: number;
}

const StackedBarChart: React.FC<StackedBarChartProps> = ({ bu, height = 200 }) => {
  const [chartData, setChartData] = useState<AlertAgeingData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Color palette
  const colors = ['#00c49f', '#8b5cf6', '#ec4899', '#f97316'];

  // Custom Tooltip Component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-300 p-4 shadow-lg rounded-md">
          <p className="font-bold mb-2">{`Alert Ageing: ${label}`}</p>
          <div className="flex items-center mb-1">
            <div
              className="w-[10px] h-[10px] mr-2"
              style={{ backgroundColor: colors[0] }}
            />
            <span className="mr-2">Alert Count:</span>
            <span className="font-semibold">{payload[0].value}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const response = await fetchTerminalData('alert_ageing', bu);
        
        // Transform data to match chart requirements
        const transformedData = response.data.map((item: AlertAgeingData) => ({
          date: item.alert_ageing,
          [bu]: item.alert_count
        }));

        setChartData(transformedData);
        setIsLoading(false);
      } catch (err) {
        setError('Failed to fetch chart data');
        setIsLoading(false);
      }
    };

    fetchData();
  }, [bu]);

  // Loading and error states
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>No Data</div>;

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
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
          <XAxis dataKey="date" />
          <YAxis 
            label={{ value: 'Alert Count', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey={bu} fill={`url(#gradient-0)`} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StackedBarChart;