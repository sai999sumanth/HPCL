import { useDashboard } from '@/pages/custom-dashboard/context/DashboardContext';
import { Button } from '@/@/components/ui/button';
import { Card } from '@/@/components/ui/card';
import {
  Maximize2Icon,
  Minimize2Icon,
  DownloadIcon,
  ArrowUpIcon,
  FilterIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/@/components/ui/dropdown-menu';
import { cn } from '@/@/lib/utils';
import { useChartData } from '@/hooks/useChartData';

interface ChartWrapperProps {
  id: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function ChartWrapper({
  id,
  title,
  children,
  className,
}: ChartWrapperProps) {
  const { state, dispatch } = useDashboard();
  const { breadcrumbs, canDrillUp } = useChartData(id as keyof typeof state.charts);
  const chartState = state.charts[id] || { isMaximized: false };

  const handleMaximize = () => {
    dispatch({ type: 'MAXIMIZE_CHART', chartId: id });
  };

  const handleDownload = () => {
    // Implementation for downloading chart data
    console.log('Downloading chart data...');
  };

  const handleDrillUp = () => {
    dispatch({ type: 'DRILL_UP', chartId: id });
  };

  const handleFilterChange = (filter: string) => {
    return dispatch({
      type: 'UPDATE_FILTERS',
      chartId: id,
      filters: { timeRange: filter },
    });
  };

  return (
    <Card
      className={cn(
        'p-4 transition-all duration-300',
        chartState.isMaximized ? 'fixed inset-6 z-50 mt-6 bg-background' : 'relative',
        className
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{title}</h3>
            {breadcrumbs.length > 0 && (
              <span className="text-sm text-muted-foreground">
                / {breadcrumbs.join(' / ')}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {canDrillUp && (
              <Button variant="outline" size="icon" onClick={handleDrillUp}>
                <ArrowUpIcon className="h-4 w-4" />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <FilterIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleFilterChange('7d')}>
                  Last 7 days
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleFilterChange('30d')}>
                  Last 30 days
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleFilterChange('90d')}>
                  Last 90 days
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="icon" onClick={handleDownload}>
              <DownloadIcon className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleMaximize}>
              {chartState.isMaximized ? (
                <Minimize2Icon className="h-4 w-4" />
              ) : (
                <Maximize2Icon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
      <div
        className={cn(
          'transition-all duration-300 mt-4',
          chartState.isMaximized ? 'h-[calc(100%-4rem)]' : 'h-[300px]'
        )}
      >
        {children}
      </div>
    </Card>
  );
}