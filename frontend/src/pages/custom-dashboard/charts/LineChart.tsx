import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useDashboard } from '@/pages/custom-dashboard/context/DashboardContext';
import { ChartTooltip } from './ChartTooltip';
import { useChartData } from '@/hooks/useChartData';

export function LineChart() {
  const { dispatch } = useDashboard();
  const { data } = useChartData('users');

  const handleClick = (data: any) => {
    dispatch({ type: 'DRILL_DOWN', chartId: 'users', data: data.children || [] });
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsLineChart data={data} onClick={handleClick}>
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
        <Line
          type="monotone"
          dataKey="value"
          stroke="hsl(var(--foreground))"
          strokeWidth={2}
        />
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}