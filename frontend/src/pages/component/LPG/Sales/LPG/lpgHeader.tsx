import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ChevronDown, Loader2, AlertCircle, RefreshCw, Search, Calendar, MapPin } from 'lucide-react';
import type { Plant, DatePreset } from './Types';
import DateRangeModal from './DateRangeModal';
import useAuthStore from "@/store/authStore";

interface HeaderProps {
  plants: Plant[];
  plantsLoading: boolean;
  plantsError: string | null;
  onRefresh: () => void;
  plantId: string | null;
  dateRange: { startDate: string; endDate: string };
  activePreset: DatePreset;
  updatePlant: (plantId: string | null) => void;
  updateDateRange: (startDate: string, endDate: string) => void;
  setDatePreset: (preset: 'today' | 'yesterday' | '1w' | '15d' | '1m') => void;
  selectedPlant: Plant | null;
}

const Header: React.FC<HeaderProps> = ({
  plants,
  plantsLoading,
  plantsError,
  onRefresh,
  dateRange,
  activePreset,
  updatePlant,
  updateDateRange,
  setDatePreset,
  selectedPlant
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDateRangeModalOpen, setIsDateRangeModalOpen] = useState(false);
  const { user } = useAuthStore();

  const handlePlantSelect = (plant: Plant) => {
    updatePlant(plant.id);
    setIsDropdownOpen(false);
  };

  const handleRefreshData = () => {
    onRefresh();
  };

  // Filter plants based on user's sap_id permissions
  const filteredPlantsBySapId = useMemo(() => {
    if (!user?.sap_id || !Array.isArray(user.sap_id) || user.sap_id.length === 0) {
      // If sap_id is empty or not available, show all plants
      return plants;
    }
    // Filter plants where sap_id matches any value in user's sap_id array
    // Convert user's sap_id strings to numbers for comparison
    const allowedSapIds = user.sap_id.map(id => Number(id));
    return plants.filter(plant => allowedSapIds.includes(plant.sap_id));
  }, [plants, user?.sap_id]);

  // Apply search filter on top of sap_id filter
  const filteredPlants = filteredPlantsBySapId.filter(plant =>
    plant.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const dateButtons: { label: string; preset: 'today' | 'yesterday' | '1w' | '15d' | '1m' }[] = [
    { label: 'Today', preset: 'today' },
    { label: 'Yesterday', preset: 'yesterday' },
    { label: '1 Week', preset: '1w' },
    { label: '15 Days', preset: '15d' },
    { label: '1 Month', preset: '1m' },
  ];

  const formattedStartDate = format(new Date(dateRange.startDate), 'MMM dd, yyyy');
  const formattedEndDate = format(new Date(dateRange.endDate), 'MMM dd, yyyy');
  const displayDate = formattedStartDate === formattedEndDate 
    ? formattedStartDate 
    : `${formattedStartDate} - ${formattedEndDate}`;

  return (
    <>
      <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Production Dashboard</h1>
            {selectedPlant && (
              <div className="flex items-center mt-1 text-sm text-green-600 font-medium">
                <MapPin className="w-4 h-4 mr-1.5" />
                <span>{selectedPlant.name}</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-xs text-gray-500">Showing Data For</p>
              <p className="text-sm font-medium text-gray-800">{displayDate}</p>
            </div>
            
            <div className="h-8 w-px bg-gray-200"></div>

            <div className="relative">
              <div 
                className="flex items-center bg-gray-100 rounded-md px-3 py-1.5 cursor-pointer hover:bg-gray-200 transition-colors border border-gray-300 min-w-[180px]"
                onClick={() => !plantsLoading && setIsDropdownOpen(!isDropdownOpen)}
              >
                {plantsLoading ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                    <span className="text-xs text-gray-500">Loading...</span>
                  </div>
                ) : plantsError ? (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">No Data Found</span>
                  </div>
                ) : (
                  <>
                    <span className="text-xs font-medium text-gray-800 flex-1">
                      {selectedPlant?.name || 'Select Plant'}
                    </span>
                    <ChevronDown className={`w-4 h-4 ml-2 text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </>
                )}
              </div>

              {isDropdownOpen && !plantsLoading && !plantsError && (
                <div className="absolute top-full right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-20 w-full">
                  <div className="p-2 border-b border-gray-200">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search plants..."
                        className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {filteredPlants.length > 0 ? (
                      filteredPlants.map((plant) => (
                        <div
                          key={plant.id}
                          className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          onClick={() => handlePlantSelect(plant)}
                        >
                          <div className="text-xs font-medium text-gray-900">{plant.name}</div>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-gray-500 text-center">No plants found.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-1 rounded-lg bg-gray-100 p-1">
              {dateButtons.map(btn => (
                <button
                  key={btn.preset}
                  onClick={() => setDatePreset(btn.preset)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                    activePreset === btn.preset
                      ? 'bg-white text-blue-700 shadow-sm font-semibold'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200/70'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
              <button
                onClick={() => setIsDateRangeModalOpen(true)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                  activePreset === null
                    ? 'bg-white text-blue-700 shadow-sm font-semibold'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200/70'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Date Range</span>
              </button>
            </div>
            
            <button 
              className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors shadow-sm disabled:bg-gray-400 flex items-center justify-center"
              onClick={handleRefreshData}
              disabled={plantsLoading}
              aria-label="Refresh Data"
            >
              {plantsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>
      <DateRangeModal
        isOpen={isDateRangeModalOpen}
        onClose={() => setIsDateRangeModalOpen(false)}
        onApply={updateDateRange}
      />
    </>
  );
};

export default Header;
