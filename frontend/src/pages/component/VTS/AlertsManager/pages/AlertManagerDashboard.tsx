import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Unlock } from 'lucide-react';
import { format, subDays, subWeeks, subMonths, startOfToday } from 'date-fns';
import DashboardHeader from '../components/DashboardHeader';
import AlertTable from '../components/AlertTable';
import { Button } from '../components/ui/button';
import { useAlerts } from '../hooks/useAlerts';
import { PaginationInfo, AlertRecord } from '../types';
import { UnblockConfirmationModal } from '../components/UnblockConfirmationModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/@/components/ui/tabs";
import useAuthStore from '@/store/authStore';

interface ActiveFilter {
  type: string;
  label: string;
  value: string;
}

function AlertManagerDashboard() {
  const { user } = useAuthStore();
  const userBu = user?.bu;
  const isLpgUser = Array.isArray(userBu) && userBu.includes('LPG');
  const isTasUser = Array.isArray(userBu) && userBu.includes('TAS');
  const hasUserBu = isLpgUser || isTasUser;

  const [selectedBu, setSelectedBu] = useState(isLpgUser ? 'LPG' : isTasUser ? 'TAS' : 'TAS');
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedPlant, setSelectedPlant] = useState('');
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<string | null>('t');
  const [dateRangeFilter, setDateRangeFilter] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecords, setSelectedRecords] = useState<number[]>([]);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'open' | 'waiting_approval' | 'closed'>('open');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { alerts, isLoading, error, fetchAlerts } = useAlerts();

  const handleDateRangeChange = (dateFilter: any) => {
    setDateRangeFilter(dateFilter);
    setSelectedTimeFilter(null);
    setCurrentPage(1);
  };
  
const buildApiFilters = useCallback(() => {
  const filters = [];
  
  if (selectedBu) {
    filters.push({ key: 'bu', cond: 'equals', value: selectedBu });
  }
  
  if (selectedZone) {
    filters.push({ key: 'zone', cond: 'equals', value: selectedZone });
  }
  
  if (selectedPlant) {
    filters.push({ key: 'sap_id', cond: 'equals', value: selectedPlant });
  }
  
  // Add filters based on active tab
  if (activeTab === 'open') {
    // For Open Alert tab - filter by Open status and exclude waiting for approval
    filters.push({ 
      key: 'alert_status', 
      cond: 'equals', 
      value: 'Open' 
    });
    filters.push({ 
      key: 'device_msg', 
      cond: 'not_equals', 
      value: 'request_raised_for_unblock',
      val: ''
    });
  } else if (activeTab === 'waiting_approval') {
    // For Waiting for Approval tab - filter by device_msg and alert_status
    filters.push({ 
      key: 'alert_status', 
      cond: 'equals', 
      value: 'Open' 
    });
    filters.push({ 
      key: 'device_msg', 
      cond: 'equals', 
      value: 'request_raised_for_unblock',
      val: ''
    });
  } else if (activeTab === 'closed') {
    // For Closed Alert tab - filter by Close status
    filters.push({ 
      key: 'alert_status', 
      cond: 'equals', 
      value: 'Close' 
    });
  }

  let dateValue = '';

  // Check if dateRangeFilter exists and has a value
  if (dateRangeFilter?.value) {
    // Use the custom date range filter value directly
    dateValue = dateRangeFilter.value;
  } else if (selectedTimeFilter) {
    // Fallback to predefined time filters
    const today = startOfToday();
    switch (selectedTimeFilter) {
      case 't':
        dateValue = format(today, 'yyyy-MM-dd');
        break;
      case '1d':
        dateValue = format(subDays(today, 1), 'yyyy-MM-dd');
        break;
      case '1w': {
        const oneWeekAgo = format(subWeeks(today, 1), 'yyyy-MM-dd');
        const todayStr = format(today, 'yyyy-MM-dd');
        dateValue = `${oneWeekAgo},${todayStr}`;
        break;
      }
      case '15d': {
        const fifteenDaysAgo = format(subDays(today, 15), 'yyyy-MM-dd');
        const todayStr = format(today, 'yyyy-MM-dd');
        dateValue = `${fifteenDaysAgo},${todayStr}`;
        break;
      }
      case '1m': {
        const oneMonthAgo = format(subMonths(today, 1), 'yyyy-MM-dd');
        const todayStr = format(today, 'yyyy-MM-dd');
        dateValue = `${oneMonthAgo},${todayStr}`;
        break;
      }
      case '3m': {
        const threeMonthsAgo = format(subMonths(today, 3), 'yyyy-MM-dd');
        const todayStr = format(today, 'yyyy-MM-dd');
        dateValue = `${threeMonthsAgo},${todayStr}`;
        break;
      }
    }
  }

  // Add the date filter if we have a value
  if (dateValue) {
    filters.push({ key: 'created_at', cond: 'equals', value: dateValue });
  }
  
  return filters;
}, [selectedBu, selectedZone, selectedPlant, selectedTimeFilter, dateRangeFilter, activeTab]);
  useEffect(() => {
    const filters: ActiveFilter[] = [];
    if (selectedZone) filters.push({ type: 'zone', label: 'Zone', value: selectedZone });
    if (selectedPlant) filters.push({ type: 'plant', label: 'Plant', value: selectedPlant });
    setActiveFilters(filters);
  }, [selectedZone, selectedPlant]);

  useEffect(() => {
    const apiFilters = buildApiFilters();
    fetchAlerts(apiFilters);
  }, [buildApiFilters, fetchAlerts]);

  const filteredAlerts = useMemo(() => {
    if (!searchQuery) return alerts;
    const lowercasedQuery = searchQuery.toLowerCase().trim();
    
    // Check if searching for null or N/A values
    if (lowercasedQuery === 'null' || lowercasedQuery === 'n/a' || lowercasedQuery === 'na') {
      return alerts.filter(alert => 
        Object.values(alert).some(value => {
          // Check for null, undefined, empty string, or "N/A" values
          return value === null || 
                 value === undefined || 
                 value === '' || 
                 String(value).trim() === '' ||
                 String(value).toLowerCase() === 'n/a' ||
                 String(value).toLowerCase() === 'na' ||
                 String(value).toLowerCase() === 'null';
        })
      );
    }
    
    // Regular search - check if any field contains the search query
    return alerts.filter(alert => 
      Object.values(alert).some(value => 
        value !== null && 
        value !== undefined && 
        String(value).toLowerCase().includes(lowercasedQuery)
      )
    );
  }, [alerts, searchQuery]);

  const selectedAlertsData = useMemo(() => {
    return alerts.filter(alert => selectedRecords.includes(alert.id));
  }, [alerts, selectedRecords]);

  const handleBuChange = (bu: string) => {
    setSelectedBu(bu);
    setSelectedZone('');
    setSelectedPlant('');
    setCurrentPage(1);
  };

  const handleZoneChange = (zone: string) => {
    setSelectedZone(zone);
    setCurrentPage(1);
  };

  const handlePlantChange = (plant: string) => {
    setSelectedPlant(plant);
    setCurrentPage(1);
  };

  const handleTimeFilterChange = (filter: string | null) => {
    setSelectedTimeFilter(filter);
    setDateRangeFilter(null);
    setCurrentPage(1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleRefresh = useCallback(() => {
    const apiFilters = buildApiFilters();
    fetchAlerts(apiFilters);
    setSelectedRecords([]); // Clear selections after refresh
  }, [buildApiFilters, fetchAlerts]);

  const handleClearFilter = (type: string) => {
    if (type === 'zone') setSelectedZone('');
    if (type === 'plant') setSelectedPlant('');
    setCurrentPage(1);
  };

  const handleClearTimeFilter = () => {
    setSelectedTimeFilter('t');
    setDateRangeFilter(null);
    setCurrentPage(1);
  };

  const handleSelectRecord = (id: number) => {
    setSelectedRecords(prev =>
      prev.includes(id) ? prev.filter(recordId => recordId !== id) : [...prev, id]
    );
  };

  const totalRecords = filteredAlerts.length;
  const totalPages = Math.ceil(totalRecords / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentPageData = filteredAlerts.slice(startIndex, endIndex);

  const uiPagination: PaginationInfo = {
    total: totalRecords,
    page: currentPage,
    limit: pageSize,
    totalPages: totalPages
  };

  const handleSelectAll = (checked: boolean) => {
    const currentPageIds = currentPageData.map(alert => alert.id);
    if (checked) {
      setSelectedRecords(prev => [...new Set([...prev, ...currentPageIds])]);
    } else {
      setSelectedRecords(prev => prev.filter(id => !currentPageIds.includes(id)));
    }
  };

  const isAllOnPageSelected = currentPageData.length > 0 && currentPageData.every(item => selectedRecords.includes(item.id));

  const handlePageChange = (page: number) => setCurrentPage(page);

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
    setSelectedRecords([]);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as 'open' | 'waiting_approval' | 'closed');
    setCurrentPage(1);
    setSelectedRecords([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-full mx-auto space-y-6">
        <DashboardHeader
          selectedBu={selectedBu}
          selectedZone={selectedZone}
          selectedPlant={selectedPlant}
          selectedTimeFilter={selectedTimeFilter}
          activeFilters={activeFilters}
          dateRangeFilter={dateRangeFilter}
          error={error}
          isLoading={isLoading}
          searchQuery={searchQuery}
          onBuChange={handleBuChange}
          onZoneChange={handleZoneChange}
          onPlantChange={handlePlantChange}
          onTimeFilterChange={handleTimeFilterChange}
          onDateRangeChange={handleDateRangeChange}
          onSearchChange={handleSearchChange}
          onRefresh={handleRefresh}
          onClearFilter={handleClearFilter}
          onClearTimeFilter={handleClearTimeFilter}
        />

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3 mb-4">
            <TabsTrigger value="open" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Open Alert
            </TabsTrigger>
            <TabsTrigger value="waiting_approval" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white">
              Waiting for Approval
            </TabsTrigger>
            <TabsTrigger value="closed" className="data-[state=active]:bg-gray-600 data-[state=active]:text-white">
              Closed Alert
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="open" className="mt-0">
            <AlertTable
              data={currentPageData}
              fullData={filteredAlerts}
              selectedRecords={selectedRecords}
              onSelectRecord={handleSelectRecord}
              onSelectAll={handleSelectAll}
              isAllOnPageSelected={isAllOnPageSelected}
              isLoading={isLoading}
              pagination={uiPagination}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
            
            <div className="flex justify-end items-center mt-4">
              <Button 
                className="bg-green-500 hover:bg-green-600 text-white" 
                disabled={selectedRecords.length === 0}
                onClick={() => setIsModalOpen(true)}
              >
                <Unlock className="h-4 w-4 mr-2" />
                Unblock ({selectedRecords.length})
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="waiting_approval" className="mt-0">
            <AlertTable
              data={currentPageData}
              fullData={filteredAlerts}
              selectedRecords={selectedRecords}
              onSelectRecord={handleSelectRecord}
              onSelectAll={handleSelectAll}
              isAllOnPageSelected={isAllOnPageSelected}
              isLoading={isLoading}
              pagination={uiPagination}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
            
            <div className="flex justify-end items-center mt-4">
              <Button 
                className="bg-blue-500 hover:bg-blue-600 text-white" 
                disabled={selectedRecords.length === 0}
                onClick={() => setIsModalOpen(true)}
              >
                Approve ({selectedRecords.length})
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="closed" className="mt-0">
            <AlertTable
              data={currentPageData}
              fullData={filteredAlerts}
              selectedRecords={selectedRecords}
              onSelectRecord={handleSelectRecord}
              onSelectAll={handleSelectAll}
              isAllOnPageSelected={isAllOnPageSelected}
              isLoading={isLoading}
              pagination={uiPagination}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              hideCheckboxes={true}
            />
          </TabsContent>
        </Tabs>
      </div>
      
      <UnblockConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedData={selectedAlertsData}
        actionType={activeTab === 'open' ? 'unblock' : 'approve'}
        onSuccess={handleRefresh}
      />
    </div>
  );
}

export default AlertManagerDashboard;
