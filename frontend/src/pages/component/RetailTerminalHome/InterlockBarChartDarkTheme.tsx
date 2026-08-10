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
} from "recharts";
import { fetchTerminalData } from "../RetailTerminalHome/ApiServiceFile";
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Loader2 } from 'lucide-react';

interface InterlockAlert {
  interlock_name: string;
  Critical?: number;
  High?: number;
  Medium?: number;
  [key: string]: number | string | undefined;
}

interface InterlockBarChartProps {
  bu: string;
  alert_section?: string;
  alert_status?: string;
  height?: number;
  title?: string;
  timeFilter: string;
}

const InterlockBarChartDarkTheme: React.FC<InterlockBarChartProps> = ({
  bu,
  alert_section,
  alert_status,
  height = 350,
  title = "Event Analysis",
  timeFilter,
}) => {
  const [chartData, setChartData] = useState<InterlockAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const colors = {
    Critical: '#722ed1', // Purple
    High: '#69c0ff',    // Light blue
    Medium: '#2f54eb'   // Dark blue
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1a1a2e] border border-gray-700 p-3 shadow-lg rounded-lg">
          <p className="text-white text-xs font-bold mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center mb-1">
              <div
                className="w-2 h-2 mr-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-300 text-xs mr-2">{entry.name}:</span>
              <span className="text-white text-xs font-semibold">{entry.value}</span>
            </div>
          ))}
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
        y={y - 2}
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
        const response = await fetchTerminalData(
          "analytics",
          bu,
          alert_section,
          alert_status,
          timeFilter
        );
        const interlockAlerts = response.data.interlock_alerts;

        const transformedData = interlockAlerts.map((alert: any) => {
          const { interlock_name, ...rest } = alert;
          return { name: interlock_name, ...rest };
        });

        setChartData(transformedData);
        setIsLoading(false);
      } catch (err) {
        setError("Failed to fetch chart data");
        setIsLoading(false);
      }
    };

    fetchData();
  }, [bu, alert_section, alert_status, timeFilter]);

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
        <CardTitle className="text-sm font-bold text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div style={{ height: '320px', width: '100%' }}>
          <ResponsiveContainer>
            <BarChart
              data={chartData}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 5
              }}
              barSize={15}
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
                dataKey="name"
                tick={{ fill: "white", fontSize: 10 }}
                label={{
                //   value: "Interlock Name",
                  position: "insideBottom",
                  dy: 6,
                  style: { fontSize: "10px", fill: "white" }
                }}
              />
              <YAxis
                tick={{ fill: "white", fontSize: 10 }}
                label={{
                  value: "Count",
                  angle: -90,
                  position: "insideLeft",
                  dx: -8,
                  style: { fontSize: "10px", fill: "white" }
                }}
              />
              <Tooltip content={CustomTooltip} />
              <Legend 
                wrapperStyle={{ marginBottom: -10, fontSize: '10px', color: 'white' }}
                formatter={(value) => <span style={{ color: 'white' }}>{value}</span>}
              />
              
              {Object.keys(chartData[0] || {})
                .filter((key) => key !== "name" && colors[key])
                .map((key) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    fill={`url(#gradient-${key})`}
                    radius={[4, 4, 0, 0]}
                    label={renderCustomBarLabel}
                  />
                ))}
              
              <Brush
                dataKey="name"
                height={15}
                stroke="#8884d8"
                startIndex={Math.max(0, chartData.length - 15)}
                fill="#1a1a2e"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default InterlockBarChartDarkTheme;