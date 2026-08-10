import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush
} from 'recharts';
import { fetchTerminalData } from '../RetailTerminalHome/ApiServiceFile';

interface LocationSeverityData {
  location_name: string | null;
  severity: string;
  alert_count: number;
}

interface ProcessedDataPoint {
  location: string;
  Critical: number;
  High: number;
  Medium: number;
  total: number;
}

interface LocationSeverityBarChartProps {
  bu: string;
  height?: number;
}

const LocationSeverityBarChart: React.FC<LocationSeverityBarChartProps> = ({ bu, height = 350 }) => {
  const [chartData, setChartData] = useState<ProcessedDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const colors = {
    Critical: '#f43f5e',   // Red for Critical
    High: '#f97316',       // Orange for High
    Medium: '#facc15'      // Yellow for Medium
  };

  // Custom Tooltip Component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-300 p-4 shadow-lg rounded-md">
          <p className="font-bold mb-2">{`Location: ${label}`}</p>
          {payload.map((entry: any) => (
            <div key={entry.dataKey} className="flex items-center mb-1">
              <div 
                className="w-[10px] h-[10px] mr-2" 
                style={{ backgroundColor: colors[entry.dataKey as keyof typeof colors] }}
              />
              <span className="mr-2">{entry.dataKey}:</span>
              <span className="font-semibold">{entry.value}</span>
            </div>
          ))}
          <p className="mt-2 font-bold">Total Alerts: {payload.reduce((sum: number, entry: any) => sum + entry.value, 0)}</p>
        </div>
      );
    }
    return null;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const response = await fetchTerminalData('location_severity_count', bu);

        // Process the data to group by location and severity
        const processedData = processLocationSeverityData(response.data);
        setChartData(processedData);
        setIsLoading(false);
      } catch (err) {
        setError('Failed to fetch chart data');
        setIsLoading(false);
      }
    };

    fetchData();
  }, [bu]);

  const processLocationSeverityData = (data: LocationSeverityData[]): ProcessedDataPoint[] => {
    // Group data by location and severity
    const groupedData = data.reduce<Record<string, Record<string, number>>>((acc, item) => {
      // Use 'Unknown Location' for null location names
      const locationName = item.location_name || 'Unknown Location';

      if (!acc[locationName]) {
        acc[locationName] = {
          Critical: 0,
          High: 0,
          Medium: 0
        };
      }
      acc[locationName][item.severity] = (acc[locationName][item.severity] || 0) + item.alert_count;
      return acc;
    }, {});

    // Convert to array of ProcessedDataPoint and sort by total alerts
    return Object.entries(groupedData)
      .map(([location, severities]) => ({
        location,
        Critical: severities.Critical || 0,
        High: severities.High || 0,
        Medium: severities.Medium || 0,
        total: (severities.Critical || 0) + (severities.High || 0) + (severities.Medium || 0)
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 50); // Increased to 50 to allow more zooming options
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="w-full">
      <div className="text-lg font-bold mb-4 text-gray-800">Location Wise Alert History</div>
      <ResponsiveContainer width="100%" height={height}>
  <BarChart
    layout="vertical"
    data={chartData}
    margin={{
      top: 20,
      right: 30,
      left: 20,
      bottom: 10, // Reduced bottom margin to minimize space
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

    <CartesianGrid strokeDasharray="3 3" />
    <XAxis
      type="number"
      tickFormatter={(value) => (value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value)}
    />
    <YAxis dataKey="location" type="category" width={150} />
    <Tooltip content={<CustomTooltip />} />
    <Legend wrapperStyle={{ marginBottom: -10 }} /> {/* Adjust margin below Legend */}
    <Bar dataKey="Critical" stackId="a" fill={`url(#gradient-Critical)`} />
    <Bar dataKey="High" stackId="a" fill={`url(#gradient-High)`} />
    <Bar dataKey="Medium" stackId="a" fill={`url(#gradient-Medium)`} />
   
     <Brush
            dataKey="date"
            height={15}
            stroke="#8884d8"
            endIndex={20} // Initially show first 20 locations
            />
  </BarChart>
</ResponsiveContainer>
    </div>
  );
};

export default LocationSeverityBarChart;
