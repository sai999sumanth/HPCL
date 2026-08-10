import { useMemo } from 'react';
import { useDashboard } from '@/pages/custom-dashboard/context/DashboardContext';
import { hierarchicalData } from '@/@/lib/chart-data';
import { ChartData } from '@/pages/custom-dashboard/types/charts';

export function useChartData(chartId: keyof typeof hierarchicalData) {
  const { state } = useDashboard();
  const chartState = state.charts[chartId];

  const data = useMemo(() => {
    let currentData = hierarchicalData[chartId];
    
    // Apply drill-down if available
    if (chartState?.drillDownPath?.length) {
      let tempData = [...currentData];
      for (const path of chartState.drillDownPath) {
        const item = tempData.find(d => d.name === path);
        if (item?.children) {
          tempData = item.children;
        }
      }
      currentData = tempData;
    }

    // Apply filters if available
    if (chartState?.filters) {
      currentData = currentData.filter(item => {
        return Object.entries(chartState.filters).every(([key, value]) => {
          if (key === 'minValue') return item.value >= value;
          if (key === 'maxValue') return item.value <= value;
          return true;
        });
      });
    }

    return currentData;
  }, [chartId, chartState?.drillDownPath, chartState?.filters]);

  const breadcrumbs = chartState?.drillDownPath || [];
  const canDrillUp = breadcrumbs.length > 0;

  return { 
    data,
    breadcrumbs,
    canDrillUp,
  };
}