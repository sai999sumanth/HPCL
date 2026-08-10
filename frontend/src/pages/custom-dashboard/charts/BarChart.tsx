import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChartTooltip } from './ChartTooltip';
import { useChartData } from '@/hooks/useChartData';
import { useDashboard } from '../context/DashboardContext';

export interface BarChartProps {
  dataKey: any;
  data: any[];
}

export function BarChart({dataKey, data}: BarChartProps) {

  const { dispatch } = useDashboard();
  // const { data } = useChartData('revenue');

  const handleClick = (entry: any) => {
    if (entry?.payload?.children) {
      dispatch({ type: 'DRILL_DOWN', chartId: 'revenue', itemName: entry.payload.name });
    }
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsBarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="name"
          height={60}
          tick={{ fill: 'hsl(var(--foreground))' }}
          tickLine={{ stroke: 'hsl(var(--foreground))' }}
          axisLine={{ stroke: 'hsl(var(--foreground))' }}
        />
        <YAxis
          width={80}
          tick={{ fill: 'hsl(var(--foreground))' }}
          tickLine={{ stroke: 'hsl(var(--foreground))' }}
          axisLine={{ stroke: 'hsl(var(--foreground))' }}
        />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey={dataKey} fill="#3b82f6" onClick={handleClick} />
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}