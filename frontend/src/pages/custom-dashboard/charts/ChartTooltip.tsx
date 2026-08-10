import { TooltipProps } from 'recharts';
import { Card } from '@/@/components/ui/card';

export function ChartTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  return (
    <Card className="bg-background border-border p-2 shadow-lg">
      <p className="font-medium">{label}</p>
      {payload.map((item, index) => (
        <p key={index} className="text-sm">
          {item.name}: {item.value}
        </p>
      ))}
    </Card>
  );
}