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
  ResponsiveContainer,
  Brush
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select";
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { convertUTCDateToLocalDate } from '@/hooks/useRelativeTime';
import { Alert, AlertDescription } from "@/@/components/ui/alert";
import DatePicker from '../RetailOutletHome/DatePicker';
import { apiClient } from '@/services/apiClient';

const RejectionChart = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState("0");
  const [top, setTop] = useState("0");
  const [bottom, setBottom] = useState("0");
  const [daywise, setDaywise] = useState("false");
  const [dimension, setDimension] = useState("zone");

  const colors = {
    cs: '#69c0ff',  // Light blue
    gd: '#2f54eb',  // Dark blue
    pt: '#722ed1'   // Purple
  };

  const formatLocalDateTime = (dateString) => {
    const utcDate = new Date(dateString);
    const localDate = convertUTCDateToLocalDate(utcDate);
    return localDate.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const fetchRejectionData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.post('/api/lpgrejections/get_rejections', {
        dimension,
        daywise: daywise === "true",
        days: parseInt(days),
        top: parseInt(top),
        bottom: parseInt(bottom)
      });
      
      if (!response.status) {
        const errorData = response.data;
        throw new Error(errorData.message || `Error: ${response.status} - ${response.statusText}`);
      }
      
      const result = response.data;
      
      if (!result.data || !Array.isArray(result.data)) {
        throw new Error('Invalid data format received from server');
      }
      
      const processedData = result.data.map(item => ({
        ...item,
        formattedDate: item.process_date ? formatLocalDateTime(item.process_date) : ''
      }));
      setData(processedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    fetchRejectionData();
  };

  const getDaysPlaceholder = (days) => {
    switch (days) { 
      case "0":
        return "Today";
      case "7":
        return "Last Week";
      case "14":
        return "Last 2 Weeks";
      case "21":
        return "Last 3 Weeks";
      case "28":
        return "Last Month";
      default:
        return `${days} Days`;
    }
  };

  useEffect(() => {
    fetchRejectionData();
  }, [days, top, bottom, daywise, dimension]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      const total = payload.reduce((sum, entry) => sum + entry.value, 0);

      return (
        <div className="bg-gray-800 p-1.5 rounded shadow-lg border border-gray-700">
          <p className="font-semibold text-gray-200 text-xs">
            {daywise === "true" ? payload[0].payload.formattedDate : label}
          </p>
          {payload.map((entry) => {
            const percentage = total > 0 ? (entry.value / total) * 100 : 0;
            return (
              <p key={entry.name} className="text-gray-300 text-xs">
                {`${entry.name}: ${entry.value.toLocaleString()} (${percentage.toFixed(2)}%)`}
              </p>
            );
          })}
          <p className="text-gray-200 text-xs">
            {`Total: ${total.toLocaleString()}`}
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center bg-[#1a1a2e]">
        <Loader2 className="h-6 w-6 animate-spin text-white" />
      </div>
    );
  }

  const ChartComponent = daywise === "true" ? LineChart : BarChart;

  return (
    <div className="w-full bg-[#1a1a2e] rounded-lg">
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">Rejections by {dimension}</h2>
          <div className="flex gap-1.5 ml-auto">
            <Select value={dimension} onValueChange={setDimension}>
              <SelectTrigger className="h-7 text-xs w-24 bg-gray-800 text-white border-gray-700">
                <SelectValue placeholder="Dimension" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 text-white border-gray-700">
                <SelectItem value="zone">Zone</SelectItem>
                <SelectItem value="plant">Plant</SelectItem>
              </SelectContent>
            </Select>
            <Select value={daywise} onValueChange={setDaywise}>
              <SelectTrigger className="h-7 text-xs w-28 bg-gray-800 text-gray-200 border-gray-700">
                <SelectValue placeholder="Day Wise" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 text-gray-200 border-gray-700">
                <SelectItem value="true">Day Trend</SelectItem>
                <SelectItem value="false">Bar</SelectItem>
              </SelectContent>
            </Select>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="h-7 text-xs w-28 bg-gray-800 text-gray-200 border-gray-700">
                <SelectValue placeholder="Days" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 text-gray-200 border-gray-700">
                {[0, 7, 14, 21, 28].map(value => (
                  <SelectItem key={value} value={String(value)}>
                    {getDaysPlaceholder(String(value))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DatePicker startDate={undefined} endDate={undefined} onStartDateChange={undefined} onEndDateChange={undefined} onSubmit={undefined} onCancel={undefined} />  
              <Select value={top} onValueChange={setTop}>
              <SelectTrigger className="h-7 text-xs w-20 bg-gray-800 text-white border-gray-700">
                <SelectValue placeholder="Top" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 text-white border-gray-700">
                {[0, 2, 4, 6, 8].map(value => (
                  <SelectItem key={value} value={String(value)}>Top {value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={bottom} onValueChange={setBottom}>
              <SelectTrigger className="h-7 text-xs w-24 bg-gray-800 text-white border-gray-700">
                <SelectValue placeholder="Bottom" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 text-white border-gray-700">
                {[0, 2, 4, 6, 8].map(value => (
                  <SelectItem key={value} value={String(value)}>Bottom {value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="h-[400px] w-full px-3 pb-3">
        {error ? (
          <div className="h-full flex flex-col items-center justify-center">
            <Alert variant="destructive" className="bg-gray-900/20 border-gray-900 w-96">
              {/* <AlertCircle className="h-4 w-4 text-gray-400" /> */}
              <AlertDescription className="text-gray-400 text-sm">
                No Data
              </AlertDescription>
            </Alert>
            <button
              onClick={handleRetry}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Retry</span>
            </button>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ChartComponent 
              data={data} 
              margin={{ top: 10, right: 30, left: 30, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis
                dataKey={daywise === "true" ? "formattedDate" : dimension}
                angle={-45}
                textAnchor="end"
                height={60}
                tick={{ fill: 'white', fontSize: 10 }}
              />
              <YAxis
                tick={{ fill: 'white', fontSize: 10 }}
                tickFormatter={(value) => value.toLocaleString()}
                label={{ 
                  value: 'Rejections', 
                  angle: -90, 
                  position: 'insideLeft',
                  fill: 'white',
                  fontSize: 11
                }}
              />
              <Tooltip content={<CustomTooltip active={undefined} payload={undefined} label={undefined} />} />
              <Legend 
                wrapperStyle={{ fontSize: '10px' }}
                formatter={(value) => <span style={{ color: 'white' }}>{value}</span>}
              />
              {daywise === "true" ? (
                <>
                  <Line 
                    type="monotone"
                    dataKey="cs_rejection" 
                    name="CS Rejection" 
                    stroke={colors.cs}
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone"
                    dataKey="gd_rejection" 
                    name="GD Rejection" 
                    stroke={colors.gd}
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone"
                    dataKey="pt_rejection" 
                    name="PT Rejection" 
                    stroke={colors.pt}
                    strokeWidth={2}
                  />
                </>
              ) : (
                <>
                  <Bar 
                    dataKey="cs_rejection" 
                    name="CS Rejection" 
                    stackId="a" 
                    fill={colors.cs}
                  />
                  <Bar 
                    dataKey="gd_rejection" 
                    name="GD Rejection" 
                    stackId="a" 
                    fill={colors.gd}
                  />
                  <Bar 
                    dataKey="pt_rejection" 
                    name="PT Rejection" 
                    stackId="a" 
                    fill={colors.pt}
                  />
                </>
              )}
              <Brush
                dataKey={daywise === "true" ? "formattedDate" : dimension}
                height={15}
                stroke="#8884d8"
                fill="#1a1a2e"
                startIndex={Math.max(0, data.length - 10)}
                endIndex={data.length - 1}
              />
            </ChartComponent>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default RejectionChart;
