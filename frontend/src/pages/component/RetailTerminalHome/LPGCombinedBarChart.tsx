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
  ResponsiveContainer,
  Brush,
  Cell
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select";
import { Loader2 } from 'lucide-react';
import { convertUTCDateToLocalDate } from '@/hooks/useRelativeTime';
import { DateFilter } from 'ag-grid-community';
import DatePicker from '../RetailOutletHome/DatePicker';
import { apiClient } from '@/services/apiClient';

const CombinedRateChart = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState("0");
  const [top, setTop] = useState("0");
  const [bottom, setBottom] = useState("0");
  const [daywise, setDaywise] = useState("false");
  const [dimension, setDimension] = useState("zone");
  const [chartType, setChartType] = useState("productivity");

  // Define colors for bars
  const barColors = [
    '#6bb4d7', '#6a93d7', '#6871d5', '#8169d6', '#a26bd6', 
    '#a359b4', '#d66aca', '#d66aaa', '#cd6583', '#cc6765',
    '#cc8665', '#cba365', '#cdc366', '#c0d66a', '#97cc65',
    '#75c563', '#63c46e'
  ];

  const formatLocalDateTime = (dateString) => {
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

  const fetchData = async () => {
    try {
      setLoading(true);
      const endpoint = chartType === "productivity" 
        ? '/api/lpgoperations/get_productivity_rate'
        : '/api/lpgoperations/get_productions_rate';
        
      const response = await apiClient.post(endpoint, {
          dimension,
          daywise: daywise === "true",
          days: parseInt(days),
          top: parseInt(top),
          bottom: parseInt(bottom)
        })
      const result = response.data;
      const processedData = result.data.map((item, index) => ({
        ...item,
        formattedDate: item.process_date ? formatLocalDateTime(item.process_date) : '',
        color: barColors[index % barColors.length] // Assign color to each data point
      }));
      setData(processedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const getDaysPlaceholder = (days) => {
    switch (days) {
      case "0": return "Today";
      case "7": return "Last Week";
      case "14": return "Last 2 Weeks";
      case "21": return "Last 3 Weeks";
      case "28": return "Last Month";
      default: return `${days} Days`;
    }
  };

  useEffect(() => {
    fetchData();
  }, [days, top, bottom, daywise, dimension, chartType]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.[0]) {
      const metricName = chartType === "productivity" ? "Productivity" : "Production";
      const metricValue = chartType === "productivity" ? payload[0].payload.productivity : payload[0].payload.production;
      
      return (
        <div className="bg-gray-800 p-1.5 rounded shadow-lg border border-gray-700">
          <p className="font-semibold text-gray-200 text-xs">
            {daywise === "true" ? payload[0].payload.formattedDate : label}
          </p>
          <p className="text-gray-300 text-xs">{`${dimension}: ${payload[0].payload[dimension]}`}</p>
          <p className="text-gray-300 text-xs">{`${metricName}: ${metricValue.toLocaleString()}`}</p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center bg-gray-900">
        <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[400px] flex items-center justify-center bg-gray-900">
        <p className="text-gray-400 text-sm">No Data</p>
      </div>
    );
  }

  const ChartComponent = daywise === "true" ? LineChart : BarChart;
  const DataComponent = daywise === "true" ? (
    <Line
      type="monotone"
      dataKey={chartType === "productivity" ? "productivity" : "production"}
      stroke={chartType === "productivity" ? "#BB86F6" : "#69c0ff"}
      strokeWidth={2}
      name={chartType === "productivity" ? "Productivity" : "Production"}
    />
  ) : (
    <Bar
      dataKey={chartType === "productivity" ? "productivity" : "production"}
      name={chartType === "productivity" ? "Productivity" : "Production"}
      radius={[4, 4, 0, 0]}
    >
      {data.map((entry, index) => (
        <Cell key={`cell-${index}`} fill={entry.color} />
      ))}
    </Bar>
  );

  return (
    <div className="w-full bg-[#1a1a2e] rounded-lg"> {/* Updated background color to match second code */}
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white"> {/* Updated text color */}
            {chartType === "productivity" ? "Productivity" : "Production"} Rate by {dimension}
          </h2>
          <div className="flex gap-1.5 ml-auto">
              <Select value={chartType} onValueChange={setChartType}>
              <SelectTrigger className="h-7 text-xs w-25 bg-[#2a2a3e] text-white border-gray-700">
                <SelectValue placeholder="Metric Type" />
              </SelectTrigger>
              <SelectContent className="bg-[#2a2a3e] text-white border-gray-700">
                <SelectItem value="productivity">Productivity Rate</SelectItem>
                <SelectItem value="production">Production Rate</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dimension} onValueChange={setDimension}>
              <SelectTrigger className="h-7 text-xs w-24 bg-gray-800 text-gray-200 border-gray-700">
                <SelectValue placeholder="Dimension" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 text-gray-200 border-gray-700">
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
              <SelectTrigger className="h-7 text-xs w-20 bg-gray-800 text-gray-200 border-gray-700">
                <SelectValue placeholder="Top" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 text-gray-200 border-gray-700">
                {[0, 2, 4, 6, 8].map(value => (
                  <SelectItem key={value} value={String(value)}>Top {value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={bottom} onValueChange={setBottom}>
              <SelectTrigger className="h-7 text-xs w-25 bg-gray-800 text-gray-200 border-gray-700">
                <SelectValue placeholder="Bottom" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 text-gray-200 border-gray-700">
                {[0, 2, 4, 6, 8].map(value => (
                  <SelectItem key={value} value={String(value)}>Bottom {value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="h-[400px] w-full px-3 pb-3">
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
              height={100}
              tick={{ fill: 'white', fontSize: 10 }}
            />
            <YAxis
              tick={{ fill: 'white', fontSize: 10 }}
              tickFormatter={(value) => value.toLocaleString()}
              label={{ 
                value: chartType === "productivity" ? 'Productivity' : 'Production', 
                angle: -90, 
                position: 'insideLeft',
                fill: 'white', 
                fontSize: 11
              }}
            />
            <Tooltip content={<CustomTooltip active={undefined} payload={undefined} label={undefined} />} />
            {DataComponent}
            <Brush
              dataKey={daywise === "true" ? "formattedDate" : dimension}
              height={15}
              stroke="#8884d8"
              fill="#1a1a2e"
              startIndex={Math.max(0, data.length - 15)}
              endIndex={data.length - 1}
            />
          </ChartComponent>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CombinedRateChart;