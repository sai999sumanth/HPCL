import React, { useState } from 'react';
import CreateDevice from './CreateDevice';
import DecommissioningDash from './DecommissioningDash';
import MISAnalyticsDash from './MISAnalyticsDash';
import ReusableFilterBar from '../../Governance/VTS Analytics/ReusableFilterBar';
import useAuthStore from '@/store/authStore';

export const DeviceCommisisoningDash = () => {
  const DecommissioningDashComponent = DecommissioningDash as React.ComponentType<any>;
  const { user } = useAuthStore();
  const userBu = user?.bu;
  const isLpgUser = Array.isArray(userBu) && userBu.includes('LPG');
  const isTasUser = Array.isArray(userBu) && userBu.includes('TAS');
  const hasUserBu = isLpgUser || isTasUser;

  const [activeTab, setActiveTab] = useState('commissioning');
  const [createDeviceFormOpen, setCreateDeviceFormOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const defaultBu = isLpgUser ? 'LPG' : isTasUser ? 'TAS' : 'TAS';
  const [refreshKeys, setRefreshKeys] = useState({
    commissioning: 0,
    decommissioning: 0,
    analytics: 0,
  });

  type TabFilterState = {
    selectedBu: string;
    isBuFilterApplied: boolean;
    selectedZone: string | null;
    selectedPlant: string | null;
    selectedTimeFilter: string | null;
    dateRangeFilter: any | null;
    rawTimeFilter: string | null | { key: string; cond: string; value: string };
  };

  const [tabFilters, setTabFilters] = useState<Record<string, TabFilterState>>({
    commissioning: {
      selectedBu: defaultBu,
      isBuFilterApplied: false,
      selectedZone: null,
      selectedPlant: null,
      selectedTimeFilter: '3M',
      dateRangeFilter: null,
      rawTimeFilter: '3M',
    },
    decommissioning: {
      selectedBu: defaultBu,
      isBuFilterApplied: false,
      selectedZone: null,
      selectedPlant: null,
      selectedTimeFilter: '3M',
      dateRangeFilter: null,
      rawTimeFilter: '3M',
    },
    analytics: {
      selectedBu: defaultBu,
      isBuFilterApplied: false,
      selectedZone: null,
      selectedPlant: null,
      selectedTimeFilter: '3M',
      dateRangeFilter: null,
      rawTimeFilter: '3M',
    },
  });

  const currentFilters = tabFilters[activeTab] || tabFilters.commissioning;

  const updateActiveTabFilters = (patch: Partial<TabFilterState>) => {
    setTabFilters((prev) => ({
      ...prev,
      [activeTab]: {
        ...(prev[activeTab] || prev.commissioning),
        ...patch,
      },
    }));
  };

  const tabs = [
    { id: 'commissioning', label: 'Device Commissioning' },
    { id: 'decommissioning', label: 'Device Decommissioning' },
    { id: 'analytics', label: 'MIS & Analytics' }
  ];

  const handleTimeFilterChange = (filter: string | null | { key: string; cond: string; value: string }) => {
    updateActiveTabFilters({ rawTimeFilter: filter });
    if (filter && typeof filter === 'object' && 'key' in filter && 'value' in filter) {
      const dateRange = filter.value.split(',');
      if (dateRange.length === 2) {
        updateActiveTabFilters({
          dateRangeFilter: {
          start: new Date(dateRange[0]),
          end: new Date(dateRange[1])
          },
          selectedTimeFilter: null,
        });
      }
    } else {
      updateActiveTabFilters({
        selectedTimeFilter: filter as string | null,
        dateRangeFilter: null,
      });
    }
  };

  const handleRefresh = () => {
    updateActiveTabFilters({
      selectedBu: defaultBu,
      isBuFilterApplied: false,
      selectedZone: null,
      selectedPlant: null,
      selectedTimeFilter: '3M',
      dateRangeFilter: null,
      rawTimeFilter: '3M',
    });

    setRefreshKeys((prev) => ({
      ...prev,
      [activeTab]: (prev[activeTab as keyof typeof prev] ?? 0) + 1,
    }));
  };

  const handlePlantChange = (plant: string | null, zone: string | null) => {
    updateActiveTabFilters({
      selectedPlant: plant,
      selectedZone: zone !== undefined ? zone : currentFilters.selectedZone,
    });
  };

  const handleBuChange = (bu: string) => {
    updateActiveTabFilters({
      selectedBu: bu,
      isBuFilterApplied: true,
    });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'commissioning':
        return (
          <CreateDevice
            onFormVisibilityChange={setCreateDeviceFormOpen}
            refreshTrigger={refreshKeys.commissioning}
            selectedZone={tabFilters.commissioning.selectedZone}
            selectedPlant={tabFilters.commissioning.selectedPlant}
            selectedBu={tabFilters.commissioning.selectedBu}
            buFilterApplied={tabFilters.commissioning.isBuFilterApplied}
            parentTimeFilter={tabFilters.commissioning.rawTimeFilter}
          />
        );
      case 'decommissioning':
        return (
          <DecommissioningDashComponent
            refreshTrigger={refreshKeys.decommissioning}
            selectedZone={tabFilters.decommissioning.selectedZone}
            selectedPlant={tabFilters.decommissioning.selectedPlant}
            selectedBu={tabFilters.decommissioning.selectedBu}
            buFilterApplied={tabFilters.decommissioning.isBuFilterApplied}
            parentTimeFilter={tabFilters.decommissioning.rawTimeFilter}
          />
        );
      case 'analytics':
        return (
          <MISAnalyticsDash
            key={refreshKeys.analytics}
            parentTimeFilter={tabFilters.analytics.rawTimeFilter}
            parentZone={tabFilters.analytics.selectedZone}
            parentPlant={tabFilters.analytics.selectedPlant}
            parentBu={tabFilters.analytics.selectedBu}
            buFilterApplied={tabFilters.analytics.isBuFilterApplied}
          />
        );
      default:
        return (
          <CreateDevice
            onFormVisibilityChange={setCreateDeviceFormOpen}
            refreshTrigger={refreshKeys.commissioning}
            selectedZone={tabFilters.commissioning.selectedZone}
            selectedPlant={tabFilters.commissioning.selectedPlant}
            selectedBu={tabFilters.commissioning.selectedBu}
            buFilterApplied={tabFilters.commissioning.isBuFilterApplied}
            parentTimeFilter={tabFilters.commissioning.rawTimeFilter}
          />
        );
    }
  };

  return (
    <div className="bg-gray-100 p-1">
      <div className="bg-white p-2 !mt-0 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Heading Section */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Device Manager</h1>
          </div>

          <ReusableFilterBar
            key={refreshKeys[activeTab as keyof typeof refreshKeys]}
            refreshKey={refreshKeys[activeTab as keyof typeof refreshKeys]}
            selectedBu={currentFilters.selectedBu}
            onBuChange={handleBuChange}
            selectedZone={currentFilters.selectedZone}
            onZoneChange={(zone) => updateActiveTabFilters({ selectedZone: zone })}
            selectedPlant={currentFilters.selectedPlant}
            onPlantChange={handlePlantChange}
            timeFilter={currentFilters.selectedTimeFilter}
            onTimeFilterChange={handleTimeFilterChange}
            onRefresh={handleRefresh}
            isLoading={isRefreshing}
            disableBuSelect={hasUserBu}
          />
      </div>
    </div>

      <div className="mt-2">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {!createDeviceFormOpen && (
            <div className="flex items-center gap-3 px-2 py-0 overflow-x-auto border-b border-gray-100 bg-gray-50">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative text-sm font-semibold px-6 py-2 transition-all duration-300 whitespace-nowrap rounded-lg
                    ${activeTab === tab.id
                      ? "bg-gradient-to-r from-blue-400 to-blue-600 text-white shadow-sm"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                    }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full"></div>
                  )}
                </button>
              ))}
            </div>
          )}

          <div>
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};
