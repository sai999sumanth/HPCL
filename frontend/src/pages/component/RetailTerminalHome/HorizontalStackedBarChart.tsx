import React, { useState, useEffect, useRef } from 'react';
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

/** API response item: alert_date, interlock_name, severity, total_alerts */
type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

interface AlertData {
  alert_date: string;
  alert_section?: string;
  severity: Severity;
  total_alerts: number;
  interlock_name: string;
}

/** API response shape: { status, message, data: AlertData[] } */
interface AlertApiResponse {
  status?: boolean;
  message?: string;
  data?: AlertData[];
}

interface ProcessedDataPoint {
  date: string;
  interlock: string;
  Critical: number;
  High: number;
  Medium: number;
  Low: number;
}

interface HorizontalStackedBarChartProps {
  bu: string;
  alert_section?: string;
  height?: number | string;
  timeFilter?: string | any;
  locationFilter?: {
    zone: string | null;
    plant: string | null;
  };
  alertStatus?: string;
}

const HorizontalStackedBarChart: React.FC<HorizontalStackedBarChartProps> = ({ 
  bu, 
  height = '100%',
  timeFilter,
  locationFilter,
  alertStatus,
  alert_section
}) => {
  const [chartData, setChartData] = useState<ProcessedDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containerHeight, setContainerHeight] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const chartHeight = typeof height === 'number' ? height : containerHeight > 0 ? containerHeight : '100%';
  const barSize =
    typeof chartHeight === 'number' && chartData.length > 0
      ? Math.min(40, Math.max(12, Math.floor((chartHeight - 100) / chartData.length)))
      : 12;

  const colors: Record<Severity, string> = {
    Critical: '#f43f5e',
    High: '#f97316',
    Medium: '#facc15',
    Low: '#22c55e'
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);
      const interlockName = payload[0]?.payload?.interlock || 'Unknown';
      return (
        <div className="bg-white border border-gray-300 px-3 py-2 shadow-lg rounded-md">
          <div className="text-[11px] text-gray-500 mb-1">Interlock: {interlockName}</div>
          <span className="font-semibold text-xs">Count: {total}</span>
        </div>
      );
    }
    return null;
  };

  const processAlertData = (data: AlertData[]): ProcessedDataPoint[] => {
    const groupedData = data.reduce<Record<string, ProcessedDataPoint>>((acc, item) => {
      if (!acc[item.interlock_name]) {
        acc[item.interlock_name] = {
          date: item.alert_date,
          interlock: item.interlock_name,
          Critical: 0,
          High: 0,
          Medium: 0,
          Low: 0
        };
      }

      if (['Critical', 'High', 'Medium', 'Low'].includes(item.severity)) {
        acc[item.interlock_name][item.severity] = item.total_alerts;
      }

      return acc;
    }, {});

    return Object.values(groupedData).sort((a, b) => {
      // Sort descending: Critical first, then High, then Medium, then Low
      if (b.Critical !== a.Critical) return b.Critical - a.Critical;
      if (b.High !== a.High) return b.High - a.High;
      if (b.Medium !== a.Medium) return b.Medium - a.Medium;
      return b.Low - a.Low;
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Create location filter object for the API call
        let locationFilterObj: any = {
          ...(locationFilter?.zone && { zone: locationFilter.zone }),
          ...(locationFilter?.plant && { plant: locationFilter.plant })
        };

        let sap_id = localStorage.getItem('sapId');
        let zone = localStorage.getItem('zone');
        if(sap_id || zone) {
          locationFilterObj = {
            zone: zone,
            plant: sap_id
          }
        }
        // Directly pass the alertStatus to the API
        const response = await fetchTerminalData(
          'day_wise_alerts', 
          bu, 
          alert_section,
          alertStatus, // Pass the alertStatus here instead of hardcoding 'Open'
          timeFilter,
          'equals',
          locationFilterObj
        );
        
        
        const processedData = processAlertData(response.data);
        setChartData(processedData);
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to fetch chart data');
        setIsLoading(false);
      }
    };
  
    fetchData();
  }, [bu, timeFilter, locationFilter, alertStatus, alert_section]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateHeight = () => setContainerHeight(node.getBoundingClientRect().height);
    updateHeight();

    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
    });

    resizeObserver.observe(node);
    return () => resizeObserver.disconnect();
  }, [containerRef]);

const ChartContainer = ({ children }: { children: React.ReactNode }) => (
  <div className="w-full h-full flex flex-col">
    <div className="flex justify-between items-center mb-2 px-1">
      <div className="text-sm font-bold text-gray-800">
        {alert_section === "VTS" ? "Day-Wise-ITDG-Alerts" : "Open Alerts Breakup "}
      </div>
      <div className="text-sm text-gray-600">
        Status: <span className="font-medium">{alertStatus}</span>
      </div>
    </div>
    <div className="flex-1 min-h-[200px] pb-3 px-1" ref={containerRef}>
      {children}
    </div>
  </div>
);

if (isLoading) {
  return <ChartContainer>
    {/* <div className="h-[400px] flex items-center justify-center">Loading...</div> */}
    <div className="h-[250px] flex items-center justify-center bg-white text-gray-800">
  <div className="flex flex-col items-center gap-4">
    <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500 border-blue-500/30"></div>
    {/* <span className="text-lg font-medium">Loading...</span> */}
  </div>
</div>  
    </ChartContainer>;
}

if (error) {
  return <ChartContainer><div className="h-[400px] flex items-center justify-center">Error: {error}</div></ChartContainer>;
}

if (chartData.length === 0) {
  return (
    <ChartContainer>
      <div className="h-[400px] flex items-center justify-center text-gray-500 font-medium">
        No Data Available for {alertStatus} Alerts
      </div>
    </ChartContainer>
  );
}

const BARS_VISIBLE_DEFAULT = 10;

return (
  <ChartContainer>
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        layout="vertical"
        data={chartData}
        margin={{
          top: 10,
          right: 10,
          left: 10,
          bottom: 10,
        }}
        barSize={barSize}
        barGap={4}
        barCategoryGap={6}
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
        />
        <YAxis 
          dataKey="interlock" 
          type="category"
          width={220}
          interval={0}
          tick={{
            fontSize: Math.max(8, Math.min(12, Math.floor((typeof chartHeight === 'number' ? chartHeight : 200) / 24))),
            fill: '#343639',
          }}
          padding={{ top: 0, bottom: 0 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ marginBottom: -10 }} />

        <Bar dataKey="Critical" stackId="a" fill={`url(#gradient-Critical)`}  />
        <Bar dataKey="High" stackId="a" fill={`url(#gradient-High)`} />
        <Bar dataKey="Medium" stackId="a" fill={`url(#gradient-Medium)`} />
        <Bar dataKey="Low" stackId="a" fill={`url(#gradient-Low)`} radius={[0, 4, 4, 0]} />

        {chartData.length > BARS_VISIBLE_DEFAULT && (
          <Brush
            dataKey="interlock"
            height={15}
            stroke="#8884d8"
            startIndex={0}
            endIndex={BARS_VISIBLE_DEFAULT - 1}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  </ChartContainer>
);
};

export default HorizontalStackedBarChart;