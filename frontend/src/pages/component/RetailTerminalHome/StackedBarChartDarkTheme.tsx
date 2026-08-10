import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList
} from 'recharts';
import { fetchTerminalData } from '../RetailTerminalHome/ApiServiceFile';
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Loader2 } from 'lucide-react';

interface AlertAgeingData {
  alert_ageing: string;
  alert_count: number;
}

interface StackedBarChartProps {
  bu: string;
  height?: number;
  alert_section?: string;
  timeFilter: string;
}

const StackedBarChartDarkTheme: React.FC<StackedBarChartProps> = ({ 
  bu, 
  height = 350,
  timeFilter 
}) => {
  const [chartData, setChartData] = useState<AlertAgeingData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const colors = {
    primary: '#722ed1', // Purple
    secondary: '#69c0ff', // Light blue
    tertiary: '#2f54eb' // Dark blue
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1a1a2e] border border-gray-700 p-3 shadow-lg rounded-lg">
          <p className="text-white text-xs font-bold mb-1">{`Alert Ageing: ${label}`}</p>
          <div className="flex items-center mt-2">
            <div
              className="w-2 h-2 mr-2 rounded-full"
              style={{ backgroundColor: colors.primary }}
            />
            <span className="text-gray-300 text-xs mr-2">Alert Count:</span>
            <span className="text-white text-xs font-semibold">
              {payload[0].value}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderCustomBarLabel = (props: any) => {
    const { x, y, width, value } = props;
    return (
      <text
        x={x + width / 2}
        y={y - 4}
        fill="#fff"
        textAnchor="middle"
        fontSize={10}
        fontWeight="500"
      >
        {value}
      </text>
    );
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const response = await fetchTerminalData('alert_ageing', bu, undefined, undefined, timeFilter);

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
  }, [bu, timeFilter]);

  if (isLoading) {
    return (
      <Card className="w-full bg-[#1a1a2e] border-0">
        <CardContent className="flex items-center justify-center h-[350px]">
          <Loader2 className="h-4 w-4 animate-spin text-white" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full bg-[#1a1a2e] border-0">
        <CardContent className="flex items-center justify-center h-[350px]">
          <p className="text-white text-xs">Error: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className="w-full bg-[#1a1a2e] border-0">
        <CardContent className="flex items-center justify-center h-[350px]">
          <p className="text-white text-xs">No Data Available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full bg-[#1a1a2e] border-0">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-bold text-white">Alert Ageing</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div style={{ height: '300px', width: '100%' }}>
          <ResponsiveContainer>
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
                <linearGradient
                  id="gradient-primary"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={colors.primary} stopOpacity={1} />
                  <stop offset="100%" stopColor={colors.primary} stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="date" 
                tick={{ fill: 'white', fontSize: 10 }}
                label={{
                  value: 'Date',
                  position: 'insideBottom',
                  dy: 10,
                  style: { fontSize: '10px', fill: 'white' }
                }}
              />
              <YAxis 
                tick={{ fill: 'white', fontSize: 10 }}
                label={{ 
                  value: 'Alert Count', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { fontSize: '10px', fill: 'white' }
                }} 
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey={bu}
                fill="url(#gradient-primary)"
                radius={[4, 4, 0, 0]}
              >
                <LabelList 
                  dataKey={bu}
                  position="top"
                  content={renderCustomBarLabel}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default StackedBarChartDarkTheme;