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
  title?: string; // Added title prop
}

const TASInterlockStackedBarChart: React.FC<InterlockBarChartProps> = ({
  bu,
  alert_section,
  alert_status,
  height = 200,
  title = "Top Alerts", // Default title if none provided
}) => {
  const [chartData, setChartData] = useState<InterlockAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const colors: Record<string, string> = {
    Critical: "#69c0ff",
    High: "#2f54eb",
    Medium: "#722ed1",
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-300 p-4 shadow-lg rounded-md">
          <p className="font-bold mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center mb-1">
              <div
                className="w-[10px] h-[10px] mr-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="mr-2">{entry.name}:</span>
              <span className="font-semibold">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const response = await fetchTerminalData("analytics", bu, alert_section, alert_status);
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
  }, [bu, alert_section, alert_status]);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  if (chartData.length === 0) {
    return (
      <div className="w-full text-center text-gray-500 font-medium">
        No Data Available
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="text-sm font-bold mb-4 text-gray-800">{title}</div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          margin={{
            top: 10,
            right: 20,
            left: 10,
            bottom: 10,
          }}
          barSize={20}
        >
          <XAxis
            dataKey="name"
            label={{
              value: "Interlock Name",
              position: "insideBottom",
              dy: 25,
              style: { fontSize: "12px", textAnchor: "middle" },
            }}
          />
          <YAxis label={{ value: "Count", angle: -90, position: "insideLeft" }} />
          <Tooltip content={CustomTooltip} />
          <Legend />
          {Object.keys(chartData[0] || {})
            .filter((key) => key !== "name" && colors[key])
            .map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                fill={colors[key]}
                radius={[4, 4, 0, 0]}
                style={{ transform: `translateX(${index * 8}px)` }}
              />
            ))}
          <Brush
            className="mt-[-5px]"
            dataKey="name"
            height={20}
            stroke="#8884d8"
            startIndex={Math.max(0, chartData.length - 25)}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TASInterlockStackedBarChart;