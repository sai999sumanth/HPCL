import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select";
import { Loader2 } from 'lucide-react';
import { convertUTCDateToLocalDate } from '@/hooks/useRelativeTime';
import { apiClient } from '@/services/apiClient';

const ProductivityRateChart = () => {
  const [data, setData] = useState<any>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState("0");
  const [top, setTop] = useState("0");
  const [bottom, setBottom] = useState("0");
  const [daywise, setDaywise] = useState("false");
  const [dimension, setDimension] = useState("zone");

  const formatLocalDateTime = (dateString: string) => {
    const utcDate = new Date(dateString);
    const localDate = convertUTCDateToLocalDate(utcDate);
    return localDate.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const fetchProductivityData = async () => {
    try {
      setLoading(true);
      const response = await apiClient.post('/api/lpgoperations/get_productivity_rate', {
        dimension,
        daywise: daywise === "true",
        days: parseInt(days),
        top: parseInt(top),
        bottom: parseInt(bottom)
      });
      const result = response.data;
      const processedData = result.data.map((item: any) => ({
        ...item,
        formattedDate: item.process_date ? formatLocalDateTime(item.process_date) : ''
      }));
      setData(processedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductivityData();
  }, [days, top, bottom, daywise, dimension]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.[0]) {
      return (
        <div className="bg-white p-2 rounded shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-800">
            {daywise === "true" ? payload[0].payload.formattedDate : label}
          </p>
          <p className="text-gray-600">{`${dimension}: ${payload[0].payload[dimension]}`}</p>
          <p className="text-gray-600">{`Productivity: ${payload[0].value.toLocaleString()}`}</p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <p className="text-gray-500">No Data</p>
      </div>
    );
  }

  const ChartComponent = daywise === "true" ? LineChart : BarChart;
  const DataComponent = daywise === "true" ? (
    <Line
      type="monotone"
      dataKey="productivity"
      stroke="url(#colorGradient)"
      strokeWidth={2}
      name="Productivity"
    />
  ) : (
    <Bar
      dataKey="productivity"
      fill="url(#colorGradient)"
      name="Productivity"
      radius={[8, 8, 0, 0]}
    />
  );

  return (
    <div className="w-full p-4 bg-white rounded-lg shadow-lg">
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">Productivity Rate by {dimension}</h2>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Select value={dimension} onValueChange={setDimension}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Dimension" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="zone">Zone</SelectItem>
              <SelectItem value="plant">Plant</SelectItem>
            </SelectContent>
          </Select>
          <Select value={daywise} onValueChange={setDaywise}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Day Wise" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Day Wise</SelectItem>
              <SelectItem value="false">Plant/Zone Wise</SelectItem>
            </SelectContent>
          </Select>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Days" />
            </SelectTrigger>
            <SelectContent>
              {[0, 7, 14, 21, 28].map(value => (
                <SelectItem key={value} value={String(value)}>{value} Days</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={top} onValueChange={setTop}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Top" />
            </SelectTrigger>
            <SelectContent>
              {[0, 2, 4, 6, 8].map(value => (
                <SelectItem key={value} value={String(value)}>Top {value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={bottom} onValueChange={setBottom}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Bottom" />
            </SelectTrigger>
            <SelectContent>
              {[0, 2, 4, 6, 8].map(value => (
                <SelectItem key={value} value={String(value)}>Bottom {value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="h-[400px] w-full">
        <ResponsiveContainer>
          <ChartComponent data={data} margin={{ top: 20, right: 30, left: 40, bottom: 60 }}>
            <defs>
              <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={1} />
                <stop offset="100%" stopColor="#2563eb" stopOpacity={0.7} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey={daywise === "true" ? "formattedDate" : dimension}
              angle={-45}
              textAnchor="end"
              height={60}
              tick={{ fill: '#374151', fontSize: 12 }}
            />
            <YAxis
              tick={{ fill: '#374151' }}
              tickFormatter={(value) => value.toLocaleString()}
              label={{ 
                value: 'Productivity', 
                angle: -90, 
                position: 'insideLeft' 
              }}
            />
            <Tooltip content={<CustomTooltip active={undefined} payload={undefined} label={undefined} />} />
            {DataComponent}
          </ChartComponent>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ProductivityRateChart;