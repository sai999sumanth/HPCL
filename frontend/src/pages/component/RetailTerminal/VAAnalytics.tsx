import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/@/components/ui/card';
import { Button } from '@/@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/@/components/ui/select';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/@/components/ui/breadcrumb';
import ZonePlantSelections from '../RetailOutletHome/ZonePlantSelections';
import TimeFilterButtons from '../RetailOutletHome/TimeFilterButtons';
import MISAnalytics from './MISAnalytics';

const BU_OPTIONS = ['RO', 'SOD', 'LPG'] as const;

const VAAnalytics: React.FC = () => {
  const navigate = useNavigate();

  const [bu, setBu] = useState<string>('SOD');
  const [timeFilter, setTimeFilter] = useState<string | null>('1m');
  const [dateRangeFilter, setDateRangeFilter] = useState<any>(null);
  const [locationFilter, setLocationFilter] = useState<{
    zone: string | null;
    plant: string | null;
  }>({
    zone: null,
    plant: null
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setTimeFilter('1m');
    setDateRangeFilter(null);
    setRefreshKey((prev) => prev + 1);
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleZoneChange = (zone: string | null) => {
    setLocationFilter(prev => ({
      ...prev,
      zone,
      plant: null
    }));
  };

  const handlePlantChange = (plant: string | null) => {
    setLocationFilter(prev => ({
      ...prev,
      plant
    }));
  };

  const handleTimeFilterChange = (filter: string | null) => {
    // When called with null (from custom date range), just clear the time filter
    // and keep the existing dateRangeFilter intact.
    if (!filter) {
      setTimeFilter(null);
      return;
    }

    const filterMap: { [key: string]: string } = {
      today: 't',
      yesterday: 'y',
      '1week': '1w',
      '1month': '1m',
      '3months': '3m'
    };

    setTimeFilter(filterMap[filter] || filter);
    // When switching to a preset time filter, clear any custom date range.
    setDateRangeFilter(null);
  };

  const handleDateRangeChange = (dateFilter: any) => {
    setDateRangeFilter(dateFilter);
    setTimeFilter(null);
  };

  return (
    <div className="space-y-0 bg-white pt-1 rounded-lg shadow-md">
      <div className="relative z-30 flex items-center justify-between pb-1 pl-1 pr-1">
        <Breadcrumb>
          <BreadcrumbList className="flex items-center text-gray-500">
            <BreadcrumbItem>
              <BreadcrumbLink
                onClick={() => navigate('/VA/VAHome')}
                className="hover:text-gray-700 cursor-pointer"
              >
                VA Home
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbPage className="text-gray-900">
                VA Analytics
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="relative z-30 flex items-center gap-4">
          <Select value={bu} onValueChange={setBu}>
            <SelectTrigger
              className="h-7 w-[80px] cursor-pointer px-2 text-xs text-gray-900 shadow-sm"
              aria-label="Business unit"
            >
              <SelectValue placeholder="BU" />
            </SelectTrigger>
            <SelectContent className="z-[10000]">
              {BU_OPTIONS.map((option) => (
                <SelectItem
                  key={option}
                  value={option}
                  className="cursor-pointer text-xs"
                >
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ZonePlantSelections
            bu="TAS"
            onZoneChange={handleZoneChange}
            onPlantChange={handlePlantChange}
            onAlertTypeChange={undefined}
          />
          <TimeFilterButtons
            selectedFilter={timeFilter}
            onFilterChange={handleTimeFilterChange}
            onDateRangeChange={handleDateRangeChange}
          />
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white p-1 px-2 rounded-md flex items-center gap-2 h-7 text-xs"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Card className="ml-1 w-[95%] md:w-[98%] lg:w-[99%] rounded-lg shadow-sm">
        <CardContent className="p-1">
          <MISAnalytics
            bu={bu}
            timeFilter={timeFilter}
            dateRangeFilter={dateRangeFilter}
            zone={locationFilter.zone}
            plant={locationFilter.plant}
            refreshKey={refreshKey}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default VAAnalytics;
