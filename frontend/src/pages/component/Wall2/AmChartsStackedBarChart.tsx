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
  LabelList,
  Brush,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Loader2 } from 'lucide-react';
import { fetchTerminalData } from '../RetailTerminalHome/ApiServiceFile';

interface ChartProps {
  bu: string;
  alert_section?: string;
  alert_status?: string;
  title: string;
}

interface LabelProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  value?: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

const AmChartsStackedBarChart: React.FC<ChartProps> = ({
  bu,
  alert_section,
  alert_status,
  title,
}) => {
  const [activeBar, setActiveBar] = useState<number | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const CHART_COLORS = {
    High: '#69c0ff',    // Light blue
    Medium: '#2f54eb',  // Dark blue
    Critical: '#722ed1' // Purple
  };
  
  const CHART_MARGINS = {
    top: 5,
    right: 10,
    left: 10,
    bottom: 200
  };

  const CustomTooltip: React.FC<TooltipProps> = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-bold text-gray-800 mb-1 text-xs">{label}</p>
          {payload.map((entry, index) => (
            <p
              key={index}
              className="text-xs flex justify-between items-center gap-4"
              style={{ color: entry.color }}
            >
              <span>{entry.name}:</span>
              <span className="font-semibold">{entry.value.toLocaleString()}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomLabel: React.FC<LabelProps> = ({ x, y, width, height, value }) => {
    if (!value || !width || width < 40) return null;
  
    return (
      <text
        x={x! + width / 2}
        y={y! + height! / 2}
        fill="white"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={9}
        fontWeight="bold"
      >
        {value.toLocaleString()}
      </text>
    );
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetchTerminalData(
          "analytics",
          bu,
          alert_section,
          alert_status
        );
        
        const transformedData = response.data.interlock_alerts.map((alert: any) => ({
          interlock_name: alert.interlock_name,
          Critical: alert.Critical || 0,
          High: alert.High || 0,
          Medium: alert.Medium || 0
        }));

        setData(transformedData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [bu, alert_section, alert_status]);

  if (loading) {
    return (
      <Card className="w-full bg-[#1a1a2e] border-0">
        <CardContent className="flex items-center justify-center h-[500px]">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </CardContent>
      </Card>
    );
  }

  if (error) { 
    return (
      <Card className="w-full bg-[#1a1a2e] border-0">
        <CardContent className="flex items-center justify-center h-[500px]">
          <p className="text-white text-xs">Error: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="w-full bg-[#1a1a2e] border-0">
        <CardContent className="flex items-center justify-center h-[500px]">
          <p className="text-white text-xs">No data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full bg-[#1a1a2e] border-0">
      <CardHeader className="pb-0">
        <CardTitle className="text-lg font-bold text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[500px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={CHART_MARGINS}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis
                dataKey="interlock_name"
                tick={{ fill: 'white', fontSize: 10 }}
              />
              <YAxis
                tick={{ fill: 'white', fontSize: 10 }}
                axisLine={{ stroke: 'white' }}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                height={30}
                iconType="circle"
                wrapperStyle={{ color: 'white', fontSize: '10px' }}
                formatter={(value) => <span style={{ color: 'white' }}>{value}</span>}
              />
              <Brush
                dataKey="interlock_name"
                height={15}
                stroke="#8884d8"
              />
              {Object.keys(CHART_COLORS).map((key) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="a"
                  fill={CHART_COLORS[key as keyof typeof CHART_COLORS]}
                  onMouseEnter={(_, index) => setActiveBar(index)}
                  onMouseLeave={() => setActiveBar(null)}
                  opacity={activeBar === null ? 1 : 0.6}
                >
                  <LabelList
                    dataKey={key}
                    content={<CustomLabel />}
                    position="center"
                  />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default AmChartsStackedBarChart;