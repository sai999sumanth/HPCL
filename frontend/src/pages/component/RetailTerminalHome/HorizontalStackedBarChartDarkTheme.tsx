import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
} from 'recharts';
import { fetchTerminalData } from './ApiServiceFile';
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Loader2 } from 'lucide-react';

interface AlertData {
  alert_date: string;
  severity: string;
  total_alerts: number;
  interlock_name?: string;
}

interface ProcessedDataPoint {
  date: string;
  Critical: number;
  High: number;
  Medium: number;
}

interface HorizontalStackedBarChartProps {
  bu: string;
  height?: number;
  alert_section?: string;
  timeFilter: string;
}

const HorizontalStackedBarChartDarkTheme: React.FC<HorizontalStackedBarChartProps> = ({ 
  bu, 
  height = 350,
  timeFilter 
}) => {
  const [chartData, setChartData] = useState<ProcessedDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const colors = {
    Critical: '#722ed1', // Purple
    High: '#69c0ff',    // Light blue
    Medium: '#2f54eb'   // Dark blue
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const interlockName = payload[0]?.payload?.interlockName;
      return (
        <div className="bg-[#1a1a2e] border border-gray-700 p-3 shadow-lg rounded-lg">
          <p className="text-white text-xs font-bold mb-1">Interlock: {interlockName || 'N/A'}</p>
          <p className="text-white text-xs font-bold mb-2">Date: {label}</p>
          {payload.map((entry: any) => (
            <div key={entry.dataKey} className="flex items-center mb-1">
              <div 
                className="w-2 h-2 mr-2 rounded-full" 
                style={{ backgroundColor: colors[entry.dataKey as keyof typeof colors] }}
              />
              <span className="text-gray-300 text-xs mr-2">{entry.dataKey}:</span>
              <span className="text-white text-xs font-semibold">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const processAlertData = (data: AlertData[]): ProcessedDataPoint[] => {
    const groupedData = data.reduce<Record<string, Record<string, number>>>((acc, item) => {
      if (!acc[item.alert_date]) {
        acc[item.alert_date] = { Critical: 0, High: 0, Medium: 0 };
      }
      acc[item.alert_date][item.severity] = item.total_alerts;
      return acc;
    }, {});
  
    return Object.entries(groupedData).map(([date, severities]) => ({
      date,
      Critical: severities.Critical,
      High: severities.High,
      Medium: severities.Medium,
      interlockName: data.find((d) => d.alert_date === date)?.interlock_name || 'Unknown',
    }));
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const response = await fetchTerminalData('day_wise_alerts', bu, undefined, undefined, timeFilter);
        const processedData = processAlertData(response.data);
        setChartData(processedData);
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
        <CardTitle className="text-sm font-bold text-white">Day-Wise-Alerts</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div style={{ height: '300px', width: '100%' }}>
          <ResponsiveContainer>
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{
                top: 10,
                right: 20,
                left: 10,
                bottom: 0,
              }}
            >
              <defs>
                {Object.entries(colors).map(([severity, color]) => (
                  <linearGradient
                    key={`gradient-${severity}`}
                    id={`gradient-${severity}`}
                    x1="0" y1="0" x2="0" y2="1"
                  >
                    <stop offset="0%" stopColor={color} stopOpacity={1} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                  </linearGradient>
                ))}
              </defs>

              <XAxis
                type="number"
                tickFormatter={(value) =>
                  value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value
                }
                tick={{ fill: 'white', fontSize: 10 }}
              />
              <YAxis 
                dataKey="date" 
                type="category" 
                tick={{ fill: 'white', fontSize: 10 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ marginBottom: -10, fontSize: '10px', color: 'white' }}
                formatter={(value) => <span style={{ color: 'white' }}>{value}</span>}
              />

              <Bar dataKey="Critical" stackId="a" fill={`url(#gradient-Critical)`} />
              <Bar dataKey="High" stackId="a" fill={`url(#gradient-High)`} />
              <Bar dataKey="Medium" stackId="a" fill={`url(#gradient-Medium)`} radius={[0, 4, 4, 0]} />

              <Brush
                className="mt-[-5px]"
                dataKey="date"
                height={15}
                stroke="#8884d8"
                startIndex={Math.max(0, chartData.length - 15)}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default HorizontalStackedBarChartDarkTheme;