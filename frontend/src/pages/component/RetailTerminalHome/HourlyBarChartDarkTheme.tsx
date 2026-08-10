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
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Loader2 } from 'lucide-react';
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
  alert_section?: string;
  value?: string;
  height?: number;
}

const HourlyBarChartDarkTheme: React.FC<HourlyBarChartProps> = ({
  bu,
  alert_section,
  value = '24h',
  height = 350,
}) => {
  const [chartData, setChartData] = useState<TransformedData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const colors = {
    primary: '#60a5fa',
  };

  const fetchHourlyData = async () => {
    try {
      const filters = [
        { key: 'bu', cond: 'equals', value: bu },
        { key: 'alert_status', cond: 'equals', value: 'Open' },
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
        <div className="bg-[#1a1a2e] border border-gray-700 p-3 shadow-lg rounded-lg">
          <p className="text-white text-xs font-bold mb-1">{data.interlock_name}</p>
          <p className="text-white text-xs">{data.fullDisplay}</p>
          <div className="flex items-center mt-2">
            <div
              className="w-2 h-2 mr-2 rounded-full"
              style={{ backgroundColor: colors.primary }}
            />
            <span className="text-gray-300 text-xs mr-2">Count:</span>
            <span className="text-white text-xs font-semibold">
              {payload[0].value.toLocaleString()}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

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
        <CardTitle className="text-sm font-bold text-white">
          Last {value} Alert Trend
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div style={{ height: '300px', width: '100%' }}>
          <ResponsiveContainer>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{
                top: 10,
                right: 30,
                left: 10,
                bottom: 0,
              }}
            >
              <defs>
                <linearGradient
                  id="gradient-primary"
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="0"
                >
                  <stop offset="0%" stopColor={colors.primary} stopOpacity={1} />
                  <stop offset="100%" stopColor={colors.primary} stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} horizontal={false} stroke="#4a5568" />
              <XAxis
                type="number"
                domain={[0, 'dataMax + 100']}
                tick={{ fill: 'white', fontSize: 10 }}
                tickFormatter={(value) =>
                  value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value
                }
              />
              <YAxis
                type="category"
                dataKey="fullDisplay"
                tick={{ fill: 'white', fontSize: 10 }}
                width={65}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="count"
                fill="url(#gradient-primary)"
                radius={[0, 4, 4, 0]}
              >
                <LabelList
                  dataKey="count"
                  position="right"
                  style={{ fontSize: '10px', fill: 'white', fontWeight: 'bold' }}
                  formatter={(value: number) => value.toLocaleString()}
                />
              </Bar>
              <Brush
                dataKey="fullDisplay"
                height={15}
                stroke={colors.primary}
                startIndex={Math.max(0, chartData.length - 10)}
                fill="#1a1a2e"
                travellerWidth={8}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default HourlyBarChartDarkTheme;