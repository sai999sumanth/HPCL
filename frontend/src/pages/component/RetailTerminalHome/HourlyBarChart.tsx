import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LabelList,
  Brush,
} from 'recharts';
import axios from 'axios';
import { convertUTCDateToLocalDate } from '@/hooks/useRelativeTime';
import { apiClient } from '@/services/apiClient';

interface HourlyAlertData {
  alert_hour: string;
  alert_count: number;
  interlock_name: string;
}

interface TransformedData {
  formattedTime: string;
  count: number;
  displayDate: string;
  fullDisplay: string;
  interlock_name: string;
}

interface HourlyBarChartProps {
  bu: string;
  alertStatus: string;
  alert_section?: string;
  value?: string;
  height?: number;
}

const HourlyBarChart: React.FC<HourlyBarChartProps> = ({
  bu,
  alert_section,
  alertStatus,
  value = '24h',
  height = 250,
}) => {
  const [chartData, setChartData] = useState<TransformedData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const colors = ['#38bdf9', '#8b5cf6', '#ec4899', '#f97316'];

  const fetchHourlyData = async () => {
    try {
      const filters = [
        { key: 'bu', cond: 'equals', value: bu },
        { key: 'alert_status', cond: 'equals', value: alertStatus }, // Use the passed alertStatus
        { key: 'created_at', cond: 'date_filter', value: value },
      ];

      if (alert_section) {
        filters.push({ key: 'alert_section', cond: 'equals', value: alert_section });
      }

      const response = await apiClient.post('/api/charts/generate_vis_data', {
        filters,
        action: 'hourly_alerts',
        drill_state: '',
      });

      const transformedData = response.data.data.map((item: HourlyAlertData) => {
        const utcDate = new Date(item.alert_hour);
        const localDate = convertUTCDateToLocalDate(utcDate);

        return {
          formattedTime: localDate.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          count: item.alert_count,
          displayDate: localDate.toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
          }),
          fullDisplay: `${localDate.toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
          })} ${localDate.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}`,
          interlock_name: item.interlock_name,
        };
      });

      transformedData.sort((a, b) => {
        const [dateA, timeA] = a.fullDisplay.split(' ');
        const [dateB, timeB] = b.fullDisplay.split(' ');
        const dateTimeA = new Date(`${dateA} ${timeA}`).getTime();
        const dateTimeB = new Date(`${dateB} ${timeB}`).getTime();
        return dateTimeA - dateTimeB;
      });

      setChartData(transformedData);
      setIsLoading(false);
    } catch (err) {
      setError('Failed to fetch hourly data');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHourlyData();
  }, [bu, alert_section, value]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white border border-gray-300 p-4 shadow-lg rounded-md">
          <p className="font-bold mb-2">Interlock: {data.interlock_name}</p>
          <p className="font-bold mb-2">Date: {data.fullDisplay}</p>
          <div className="flex items-center mb-1">
            <div
              className="w-2 h-2 mr-2 rounded-full"
              style={{ backgroundColor: colors[0] }}
            />
            <span className="mr-2">Alert Count:</span>
            <span className="font-semibold">{payload[0].value.toLocaleString()}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Common container component for consistent layout
  const ChartContainer = ({ children }: { children: React.ReactNode }) => (
    <div className="w-full">
      <div className="text-sm font-bold mb-4 text-gray-800">Last {value} Alert Trend</div>
      {children}
    </div>
  );

  if (isLoading) {
    return (
      <ChartContainer>
        <div className="h-[250px] flex items-center justify-center">
          <div>Loading...</div>
        </div>
      </ChartContainer>
    );
  }

  if (error) {
    return (
      <ChartContainer>
        <div className="h-[250px] flex items-center justify-center">
          <div>Error: {error}</div>
        </div>
      </ChartContainer>
    );
  }

  if (chartData.length === 0) {
    return (
      <ChartContainer>
        <div className="h-[250px] flex items-center justify-center text-gray-500 font-medium">
          No Data Available
        </div>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{
            top: 20,
            right: 30,
            left: 10,
            bottom: 40,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.1} horizontal={false} />
          <defs>
            {colors.map((color, index) => (
              <linearGradient
                key={`gradient-${index}`}
                id={`gradient-${index}`}
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <stop offset="0%" stopColor={color} stopOpacity={1} />
                <stop offset="100%" stopColor={color} stopOpacity={0.7} />
              </linearGradient>
            ))}
          </defs>
          <XAxis
            type="number"
            domain={[0, 'dataMax + 100']}
            label={{
              value: 'Alert Count',
              position: 'insideBottom',
              dy: 10,
              style: { fontSize: '12px', textAnchor: 'middle' },
            }}
          />
          <YAxis
            type="category"
            dataKey="fullDisplay"
            tick={{ fontSize: 10 }}
            width={70}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" fill={`url(#gradient-0)`} radius={[0, 8, 8, 0]}>
            <LabelList
              dataKey="count"
              position="right"
              style={{ fontSize: '10px', fill: '#4A5568', fontWeight: 'bold' }}
              formatter={(value: number) => value.toLocaleString()}
            />
          </Bar>
          <Brush
            dataKey="fullDisplay"
            height={15}
            stroke="#8884d8"
            startIndex={Math.max(0, chartData.length - 10)}
            y={height - 30}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

export default HourlyBarChart;