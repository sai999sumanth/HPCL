import React from 'react';
import EnhancedTimeFilter from '@/pages/component/Governance/filters/TimeFilterButtons';

type FilterValue = string | null | { key: string; cond: string; value: string };

type Props = {
  selectedFilter: FilterValue;
  onFilterChange: (value: FilterValue) => void;
  resetTrigger?: number;
  isLoading?: boolean;
};

/**
 * Calendar-only time control (today/yesterday presets + custom range). Shared by Product
 * Insight and the supply-hub product cards / Stock Utilization (each parent keeps its own selected value).
 */
export default function TASSupplyChainProductInsightCalendar({
  selectedFilter,
  onFilterChange,
  resetTrigger,
  isLoading,
}: Props) {
  return (
    <EnhancedTimeFilter
      selectedFilter={selectedFilter}
      onFilterChange={onFilterChange}
      resetTrigger={resetTrigger}
      isLoading={isLoading}
      calendarOnly
      onlyTodayAndYesterday
    />
  );
}
