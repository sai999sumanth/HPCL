import { useState, useCallback } from 'react';
import { format, subMonths, startOfDay, endOfDay, subDays } from 'date-fns';
import type { DatePreset } from '../Types';

// This function is purely functional and stable. It no longer mutates Date objects.
const getDateRangeForPreset = (preset: 'today' | 'yesterday' | '1w' | '15d' | '1m'): { startDate: string; endDate: string } => {
  const today = startOfDay(new Date()); // Use startOfDay for consistency
  let startDate: Date;
  let endDate: Date;

  switch (preset) {
    case 'today':
      startDate = today;
      endDate = endOfDay(today);
      break;
    case 'yesterday':
      const yesterday = subDays(today, 1);
      startDate = yesterday;
      endDate = endOfDay(yesterday);
      break;
    case '1w':
      startDate = subDays(today, 6);
      endDate = endOfDay(today);
      break;
    case '15d':
      startDate = subDays(today, 14);
      endDate = endOfDay(today);
      break;
    case '1m':
      startDate = subMonths(today, 1);
      endDate = endOfDay(today);
      break;
  }
  
  return {
    startDate: format(startDate, 'yyyy-MM-dd'),
    endDate: format(endDate, 'yyyy-MM-dd'),
  };
};

export const useDashboardFilters = () => {
  const [plantId, setPlantId] = useState<string | null>(null);
  
  // THE FIX: The default preset is now 'today'.
  const [dateRange, setDateRange] = useState(() => getDateRangeForPreset('today'));
  const [activePreset, setActivePreset] = useState<DatePreset>('today');

  const updatePlant = useCallback((id: string | null) => {
    setPlantId(id);
  }, []);

  const updateDateRange = useCallback((startDate: string, endDate: string) => {
    setDateRange({ startDate, endDate });
    setActivePreset(null);
  }, []);

  const setDatePreset = useCallback((preset: 'today' | 'yesterday' | '1w' | '15d' | '1m') => {
    setDateRange(getDateRangeForPreset(preset));
    setActivePreset(preset);
  }, []);

  return {
    plantId,
    dateRange,
    activePreset,
    updatePlant,
    updateDateRange,
    setDatePreset,
  };
};
