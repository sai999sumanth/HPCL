import React, { useState, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import ReusableFilterBar from '@/pages/component/Governance/VTS Analytics/ReusableFilterBar';
import useAuthStore from '@/store/authStore';
import { apiClient } from '@/services/apiClient';
import LocalLoadedTT from './LocalLoadedTT';
import MFMKFactor from './MFMKFactor';
import BayReassignment from './BayReassignment';
import UnauthorisedFlow from './UnauthorisedFlow';

export type PlantOption = { id: string; name: string };

const BCUDashboard = () => {
  const { user } = useAuthStore();
  const userBu = user?.bu;
  const isLpgUser = Array.isArray(userBu) && userBu.includes('LPG');
  const isTasUser = Array.isArray(userBu) && userBu.includes('TAS');
  const hasUserBu = isLpgUser || isTasUser;

  const [activeTab, setActiveTab] = useState('Local Loaded TT');
  const [selectedBu, setSelectedBu] = useState(isLpgUser ? 'LPG' : isTasUser ? 'TAS' : 'TAS');
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<string | null>(null);
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<string | null>('15D');
  const [dateRangeFilter, setDateRangeFilter] = useState<{ start: Date; end: Date } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [plantData, setPlantData] = useState<PlantOption[]>([]);

  // Fetch location/plant details once at dashboard level (not per tab)
  useEffect(() => {
    const fetchPlantData = async () => {
      try {
        const zoneFilter = selectedZone ? [selectedZone] : [];
        const payload = {
          bu: selectedBu === 'SOD' ? 'TAS' : selectedBu,
          zone: zoneFilter,
          plant: []
        };
        const response = await apiClient.post('/api/indentdryout/get_distinct_location_details', payload);
        if (response?.data?.status === true && response.data.data?.plant) {
          const plants: PlantOption[] = response.data.data.plant.map((p: any) => ({
            id: String(p.id || p.sap_id || ''),
            name: p.name || p.location_name || ''
          })).filter((p: PlantOption) => p.id && p.name);
          setPlantData(plants);
        }
      } catch (error) {
        console.error("Error fetching plant data:", error);
      }
    };
    fetchPlantData();
  }, [selectedBu, selectedZone]);

  const handleTimeFilterChange = (filter: string | null) => {
    const f = filter as string | null | { key: string; cond: string; value: string };
    if (f && typeof f === 'object' && 'value' in f) {
      const dateRange = f.value.split(',');
      if (dateRange.length === 2) {
        setDateRangeFilter({
          start: new Date(dateRange[0]),
          end: new Date(dateRange[1])
        });
        setSelectedTimeFilter(null);
      }
    } else {
      setSelectedTimeFilter(f as string | null);
      setDateRangeFilter(null);
    }
  };

  const handleRefresh = () => {
    setSelectedBu(isLpgUser ? 'LPG' : isTasUser ? 'TAS' : 'TAS');
    setSelectedZone(null);
    setSelectedPlant(null);
    setSelectedTimeFilter('15D');
    setDateRangeFilter(null);
    setRefreshKey(prev => prev + 1);
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const selectedTimeFilterForTabs: string | null | { key: string; cond: string; value: string } =
    dateRangeFilter && dateRangeFilter.start && dateRangeFilter.end
      ? { key: 'Date', cond: 'equals', value: `${fmt(dateRangeFilter.start)},${fmt(dateRangeFilter.end)}` }
      : selectedTimeFilter;

  const tabs = [
    'Local Loaded TT',    
    'Bay Reassignment',
    'Unauthorised Flow',
    'BCU MFM Totalizer Diff',   
    // 'Sick TT',
    // 'Cancelled TT',
    // 'K-Factor Changes',
    
  ];

  // Dummy data for other tabs (when not Local Loaded TT)
  const locationData = [
    { name: 'Terminal Alpha', value: 92, max: 92 },
    { name: 'Terminal Beta', value: 78, max: 92 },
    { name: 'Zone Gamma', value: 65, max: 92 },
    { name: 'Hub Delta', value: 45, max: 92 },
    { name: 'Port Epsilon', value: 38, max: 92 }
  ];

  return (
    <div className="bg-gray-100 p-2 space-y-4">
      <div className="bg-white p-2 !mt-0 rounded-xl shadow-sm border border-gray-100 mb-2">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">BCU Critical Parameters</h1>
            {/* <p className="text-gray-500 text-sm mt-1">Real-time terminal analytics and load monitoring metrics</p> */}
          </div>

          {/* Filter Bar - BU filter dropdown hidden */}
          <ReusableFilterBar
            key={refreshKey}
            refreshKey={refreshKey}
            selectedBu={selectedBu}
            onBuChange={setSelectedBu}
            selectedZone={selectedZone}
            onZoneChange={setSelectedZone}
            selectedPlant={selectedPlant}
            onPlantChange={setSelectedPlant}
            timeFilter={selectedTimeFilter}
            onTimeFilterChange={handleTimeFilterChange}
            onRefresh={handleRefresh}
            isLoading={isRefreshing}
            hideBuSelect={true}
            // disableBuSelect={hasUserBu}
          />
        </div>
      </div>

      {/* Tabs and Content Combined */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Tabs */}
        <div className="p-2 border-b border-gray-200">
          <div className="flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-4 px-2 font-medium transition-colors relative text-sm ${
                  activeTab === tab
                    ? 'text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className={activeTab === 'Local Loaded TT' || activeTab === 'BCU MFM Totalizer Diff' || activeTab === 'Bay Reassignment' || activeTab === 'Unauthorised Flow' ? '' : 'p-6'}>
          {activeTab === 'Local Loaded TT' ? (
            <LocalLoadedTT
              selectedBu={selectedBu}
              selectedZone={selectedZone}
              selectedPlant={selectedPlant}
              selectedTimeFilter={selectedTimeFilterForTabs}
              refreshKey={refreshKey}
              plantData={plantData}
            />
          ) : activeTab === 'BCU MFM Totalizer Diff' ? (
            <MFMKFactor
              selectedBu={selectedBu}
              selectedZone={selectedZone}
              selectedPlant={selectedPlant}
              selectedTimeFilter={selectedTimeFilterForTabs}
              refreshKey={refreshKey}
              plantData={plantData}
            />
          ) : activeTab === 'Bay Reassignment' ? (
            <BayReassignment
              selectedBu={selectedBu}
              selectedZone={selectedZone}
              selectedPlant={selectedPlant}
              selectedTimeFilter={selectedTimeFilterForTabs}
              refreshKey={refreshKey}
              plantData={plantData}
            />
          ) : activeTab === 'Unauthorised Flow' ? (
            <UnauthorisedFlow
              selectedBu={selectedBu}
              selectedZone={selectedZone}
              selectedPlant={selectedPlant}
              selectedTimeFilter={selectedTimeFilterForTabs}
              refreshKey={refreshKey}
              plantData={plantData}
            />
          ) : (
            <div className="grid grid-cols-3 gap-8">
              {/* Left Section - Chart */}
              <div className="col-span-2">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">Top 10 Locations</h2>
                  <p className="text-gray-500">Maximum Quantity Local Loading (KL)</p>
                </div>

                <div className="space-y-6">
                  {locationData.map((location, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className="w-32 text-gray-600 font-medium">
                        {location.name}
                      </div>
                      <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
                          style={{ width: `${(location.value / location.max) * 100}%` }}
                        ></div>
                      </div>
                      <div className="w-16 text-right font-semibold text-gray-900">
                        {location.value}k
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Section - Stats */}
              <div className="space-y-8">
                {/* Total KL */}
                <div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-5xl font-bold text-gray-900">540,200</span>
                    <span className="text-2xl text-gray-500">KL</span>
                  </div>
                  <div className="flex items-center gap-1 text-green-500 font-medium">
                    <TrendingUp size={16} />
                    <span>12.4%</span>
                  </div>
                </div>

                {/* Key Insights */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wide">
                    Key Insights
                  </h3>
                  
                  <div className="space-y-6">
                    <div>
                      <div className="text-gray-600 mb-2">Active Loading Points</div>
                      <div className="text-3xl font-bold text-gray-900">142 Units</div>
                    </div>

                    <div>
                      <div className="text-gray-600 mb-2">Avg. Load Time</div>
                      <div className="text-3xl font-bold text-blue-600">24.5 min</div>
                    </div>

                    <div>
                      <div className="text-gray-600 mb-2">Critical Alerts</div>
                      <div className="text-3xl font-bold text-red-600">03</div>
                    </div>
                  </div>

                  <button className="w-full mt-8 px-4 py-3 border-2 border-gray-900 text-gray-900 font-semibold rounded-lg hover:bg-gray-900 hover:text-white transition-colors">
                    VIEW ALL TERMINALS
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BCUDashboard;