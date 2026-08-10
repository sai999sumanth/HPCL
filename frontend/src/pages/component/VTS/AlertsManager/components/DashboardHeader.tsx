import React from 'react';
import { RefreshCw, X, AlertCircle, Search } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import ZonePlantSelections from '@/pages/component/RetailOutletHome/ZonePlantSelections';
import EnhancedTimeFilter from '@/pages/component/RetailOutletHome/TimeFilterButtons';

interface ActiveFilter {
  type: string;
  label: string;
  value: string;
}

interface DashboardHeaderProps {
  selectedBu: string;
  selectedZone: string;
  selectedPlant: string;
  selectedTimeFilter: string | null;
  activeFilters: ActiveFilter[];
  dateRangeFilter?: any;
  error?: string | null;
  violationsError?: string;
  isLoading: boolean;
  searchQuery: string;
  onBuChange: (value: string) => void;
  onZoneChange: (value: string) => void;
  onPlantChange: (value: string) => void;
  onTimeFilterChange: (value: string | null) => void;
  onSearchChange: (value: string) => void;
  onDateRangeChange: (range: any) => void;
  onRefresh: () => void;
  onClearFilter: (type: string) => void;
  onClearTimeFilter: () => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  selectedBu,
  selectedZone,
  selectedPlant,
  selectedTimeFilter,
  activeFilters = [],
  dateRangeFilter,
  error,
  violationsError,
  isLoading,
  searchQuery,
  onBuChange,
  onZoneChange,
  onPlantChange,
  onTimeFilterChange,
  onSearchChange,
  onDateRangeChange,
  onRefresh,
  onClearFilter,
  onClearTimeFilter,
}) => {
  const dateRangeLabel = dateRangeFilter?.value ? dateRangeFilter.value.split(',').join(' to ') : 'Custom';

  const timeFilterLabels: { [key: string]: string } = {
    t: 'Today',
    '1d': 'Yesterday',
    '1w': '1 Week',
    '15d': '15 Days',
    '1m': '1 Month',
    '3m': '3 Months',
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <h1 className="text-xl font-bold mr-auto flex-shrink-0">Alert Manager</h1>
        <div className="flex flex-col lg:flex-row items-end lg:items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-7 pl-8 w-40 lg:w-48 text-xs"
            />
          </div>
          <Select value={selectedBu} onValueChange={onBuChange}>
            <SelectTrigger className="w-auto h-7 text-xs">
              <SelectValue placeholder="Select BU" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TAS">SOD</SelectItem>
              <SelectItem value="LPG">LPG</SelectItem>
            </SelectContent>
          </Select>
          <ZonePlantSelections
            zone={selectedZone}
            sapid={selectedPlant}
            onZoneChange={onZoneChange}
            onPlantChange={onPlantChange} 
            bu={selectedBu}
          />
          <EnhancedTimeFilter
            selectedFilter={selectedTimeFilter}
            onFilterChange={onTimeFilterChange}
            onDateRangeChange={onDateRangeChange}
          />
          <Button
            onClick={onRefresh}
            disabled={isLoading}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white p-1 px-2 rounded-md flex items-center gap-2 h-7 text-xs"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {(activeFilters.length > 0 || selectedTimeFilter || dateRangeFilter || error || violationsError) && (
        <div className="flex flex-col items-start gap-2 pt-2">
          {(activeFilters.length > 0 || selectedTimeFilter || dateRangeFilter) && (
            <div className="flex items-center flex-wrap gap-2">
              <span className="text-sm font-medium text-muted-foreground">Active Filters:</span>
              {activeFilters.map(filter => (
                <Badge key={filter.type} variant="secondary" className="flex items-center gap-1.5">
                  {filter.label}: {filter.value}
                  <button onClick={() => onClearFilter(filter.type)} className="rounded-full hover:bg-muted-foreground/20 p-0.5 -mr-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {selectedTimeFilter && timeFilterLabels[selectedTimeFilter] && (
                <Badge variant="secondary" className="flex items-center gap-1.5">
                  Time: {timeFilterLabels[selectedTimeFilter]}
                  <button onClick={onClearTimeFilter} className="rounded-full hover:bg-muted-foreground/20 p-0.5 -mr-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {dateRangeFilter && (
                <Badge variant="secondary" className="flex items-center gap-1.5">
                  Date Range: {dateRangeLabel}
                  <button onClick={onClearTimeFilter} className="rounded-full hover:bg-muted-foreground/20 p-0.5 -mr-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}

          {(error || violationsError) && (
            <div className="flex items-center gap-2 p-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md w-full mt-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error || violationsError}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardHeader;
