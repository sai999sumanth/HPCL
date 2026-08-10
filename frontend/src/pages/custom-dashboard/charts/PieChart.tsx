import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useDashboard } from '@/pages/custom-dashboard/context/DashboardContext';
import { ChartTooltip } from './ChartTooltip';
import { useChartData } from '@/hooks/useChartData';

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
];

export function PieChart() {
  const { dispatch } = useDashboard();
  const { data } = useChartData('distribution');

  const handleClick = (data: any) => {
    dispatch({ type: 'DRILL_DOWN', chartId: 'distribution', data: data.children || [] });
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsPieChart onClick={handleClick}>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          fill="#8884d8"
          paddingAngle={5}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
      </RechartsPieChart>
    </ResponsiveContainer>
  );
}