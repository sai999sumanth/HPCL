
import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Brush,
  Legend,
  Label,
  Cell,
} from "recharts";
import { fetchTerminalData } from "../RetailTerminalHome/ApiServiceFile";

interface InterlockAlert {
  name: string;
  shortName: string;
  Critical: number;
  High: number;
  Medium: number;
  Low: number;
  [key: string]: number | string | undefined;
}

interface InterlockBarChartProps {
  bu: string;
  alert_section?: string;
  alert_status?: string;
  height?: number | string;
  title?: string;
  timeFilter: string;
  locationFilter?: {
    zone: string | null;
    plant: string | null;
  };
}

const InterlockBarChart: React.FC<InterlockBarChartProps> = ({
  bu,
  alert_section,
  alert_status,
  height = '100%',
  title = "Event Analysis",
  timeFilter,
  locationFilter,
}) => {
  const chartHeight = typeof height === 'number' ? height : '100%';
  const [chartData, setChartData] = useState<InterlockAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const colors: Record<string, string> = {
    Critical: '#f43f5e',
    High: '#f97316',
    Medium: '#facc15',
    Low: '#22c55e'
  };

  // Function to convert full interlock name to short form
  const getShortForm = (interlockName: string): string => {
    const name = interlockName.toLowerCase();
    
    // Extract the time indicator (FirstTime, SecondTime, ThirdTime)
    let timeIndicator = '';
    if (name.includes('firsttime')) {
      timeIndicator = '1';
    } else if (name.includes('secondtime')) {
      timeIndicator = '2';
    } else if (name.includes('thirdtime')) {
      timeIndicator = '3';
    }
    
    // Map common interlock names to short forms
    if (name.includes('routedeviation')) {
      return `RD${timeIndicator}`;
    } else if (name.includes('unauthorized stoppage') || name.includes('unauthorised stoppage')) {
      return `UNS${timeIndicator}`;
    } else if (name.includes('powerdisconnect') || name.includes('power disconnect')) {
      return `PD${timeIndicator}`;
    } else if (name.includes('device tampering') || name.includes('devicetampering')) {
      return `DT${timeIndicator}`;
    } else if (name.includes('continuous driving')) {
      return `CD${timeIndicator}`;
    } else if (name.includes('night driving')) {
      return `ND${timeIndicator}`;
    } else if (name.includes('speed violation')) {
      return `SV${timeIndicator}`;
    } else if (name.includes('over speed')) {
      return `OS${timeIndicator}`;
    }
    
    // Default: return first letters of each word + time indicator
    const words = interlockName.split(' ').filter(w => w && !w.toLowerCase().includes('time') && !w.toLowerCase().includes('vts'));
    if (words.length > 0) {
      const initials = words.map(w => w[0]?.toUpperCase() || '').join('');
      return `${initials}${timeIndicator}`;
    }
    
    return interlockName.substring(0, 10); // Fallback to first 10 characters
  };

  // Function to sort interlock data by prefix and number
  const sortInterlockData = (data: InterlockAlert[]): InterlockAlert[] => {
    return [...data].sort((a, b) => {
      const shortA = a.shortName;
      const shortB = b.shortName;
      
      // Extract prefix (letters) and number from shortName (e.g., "RD1" -> prefix: "RD", number: 1)
      const matchA = shortA.match(/^([A-Z]+)(\d+)$/);
      const matchB = shortB.match(/^([A-Z]+)(\d+)$/);
      
      if (matchA && matchB) {
        const prefixA = matchA[1];
        const prefixB = matchB[1];
        const numA = parseInt(matchA[2], 10);
        const numB = parseInt(matchB[2], 10);
        
        // First sort by prefix (alphabetically)
        if (prefixA !== prefixB) {
          return prefixA.localeCompare(prefixB);
        }
        
        // If prefixes are the same, sort by number
        return numA - numB;
      }
      
      // Fallback: alphabetical sort if pattern doesn't match
      return shortA.localeCompare(shortB);
    });
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      const fullName = data?.name || label; // Use full name from data
      
      return (
        <div className="bg-white border border-gray-300 p-4 shadow-lg rounded-md">
          <p className="font-bold mb-2">{fullName}</p>
          {payload.map((entry: any, index: number) => {
            if (entry.value === 0) return null;
            return (
            <div key={index} className="flex items-center mb-1">
              <div
                className="w-[10px] h-[10px] mr-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="mr-2">{entry.name}:</span>
              <span className="font-semibold">{entry.value}</span>
            </div>
            );
          })}
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
        y={y - 5}
        fill="#666"
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
        
        // Create location filter object for the API call
        let locationFilterObj = {
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

        const response = await fetchTerminalData(
          "analytics",
          bu,
          alert_section,
          alert_status,
          timeFilter,
          'equals',
          locationFilterObj
        );
        
        const interlockAlerts = response.data.interlock_alerts;

        // Transform data: Group by interlock_name and include all severity values
        const transformedData = interlockAlerts.map((alert: any) => {
          const { interlock_name, Critical, High, Medium, Low, ...rest } = alert;
          
          return {
            name: interlock_name, // Full name for tooltip
            shortName: getShortForm(interlock_name), // Short form for X-axis label
            Critical: Critical !== undefined && Critical !== null ? Number(Critical) : 0,
            High: High !== undefined && High !== null ? Number(High) : 0,
            Medium: Medium !== undefined && Medium !== null ? Number(Medium) : 0,
            Low: Low !== undefined && Low !== null ? Number(Low) : 0,
          };
        });

        // Sort the data by prefix and number (e.g., RD1, RD2, RD3, then UNS1, UNS2, etc.)
        const sortedData = sortInterlockData(transformedData);

        setChartData(sortedData);
        setIsLoading(false);
      } catch (err) {
        setError("Failed to fetch chart data");
        setIsLoading(false);
      }
    };

    fetchData();
  }, [bu, alert_section, alert_status, timeFilter, locationFilter]);

  // Common container component for consistent layout
  const ChartContainer = ({ children }: { children: React.ReactNode }) => (
    <div className="w-full h-full flex flex-col">
      <div className="text-sm font-bold mb-4 text-gray-800">{title}</div>
      <div className="flex-1 min-h-[200px] pb-4">{children}</div>
    </div>
  );

  if (isLoading) {
    return (
      <ChartContainer>
        {/* <div className="h-[250px] flex items-center justify-center">
          <div>Loading...</div>
        </div> */}
                <div className="h-[200px] flex items-center justify-center bg-white text-gray-800">
  <div className="flex flex-col items-center gap-4">
    <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500 border-blue-500/30"></div>
    {/* <span className="text-lg font-medium">Loading...</span> */}
  </div>
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
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={chartData}
          margin={{
            top: 2,
            right: 20,
            left: -1,
            bottom: -7,
          }}
          barSize={20}
        >
          <defs>
            <linearGradient id="gradient-Critical" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.Critical} stopOpacity={1} />
              <stop offset="100%" stopColor={colors.Critical} stopOpacity={0.8} />
            </linearGradient>
            <linearGradient id="gradient-High" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.High} stopOpacity={1} />
              <stop offset="100%" stopColor={colors.High} stopOpacity={0.8} />
            </linearGradient>
            <linearGradient id="gradient-Medium" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.Medium} stopOpacity={1} />
              <stop offset="100%" stopColor={colors.Medium} stopOpacity={0.8} />
            </linearGradient>
            <linearGradient id="gradient-Low" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.Low} stopOpacity={1} />
              <stop offset="100%" stopColor={colors.Low} stopOpacity={0.8} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="shortName"
            tick={{ fontSize: 8, fill: '#666' }}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={50}
          />
          <YAxis label={{ value: "Count", angle: -90, position: "insideLeft" }} />
          <Tooltip content={CustomTooltip} />
          <Bar dataKey="Critical" stackId="a" fill={`url(#gradient-Critical)`} />
          <Bar dataKey="High" stackId="a" fill={`url(#gradient-High)`} />
          <Bar dataKey="Medium" stackId="a" fill={`url(#gradient-Medium)`} />
          <Bar dataKey="Low" stackId="a" fill={`url(#gradient-Low)`} radius={[0, 4, 4, 0]} />
          {/* Legend at the bottom showing all severity levels */}
          <Legend 
            wrapperStyle={{ paddingTop: '2px', paddingBottom: '2px' }}
            iconType="square"
            payload={[
              { value: 'Critical', type: 'square', color: colors.Critical },
              { value: 'High', type: 'square', color: colors.High },
              { value: 'Medium', type: 'square', color: colors.Medium },
              { value: 'Low', type: 'square', color: colors.Low },
            ]}
              />
            
          <Brush
            dataKey="shortName"
            height={15}
            stroke="#8884d8"
            startIndex={Math.max(0, chartData.length - 15)}
            y={typeof chartHeight === 'number' ? chartHeight - 30 : undefined}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

export default InterlockBarChart;