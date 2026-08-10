import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/@/components/ui/select';
import { Button } from '@/@/components/ui/button';
import EnhancedTimeFilter from '../filters/TimeFilterButtons';
import ZonePlantSelections from '../../RetailOutletHome/ZonePlantSelections';

interface ReusableFilterBarProps {
  selectedBu: string;
  onBuChange: (bu: string) => void;
  selectedZone: string | null;
  onZoneChange: (zone: string | null) => void;
  selectedPlant: string | null;
  onPlantChange: (plant: string | null, zone: string | null) => void;
  onPlantDisplayNameChange?: (plantName: string | null) => void;
  timeFilter: string | null;
  onTimeFilterChange: (filter: string | null) => void;
  onRefresh: () => void;
  isLoading: boolean;
  refreshKey?: number; // Add this prop to force re-render
  disableBuSelect?: boolean; // Add prop to disable BU select
  hideBuSelect?: boolean; // Add prop to hide BU select completely
  hideZonePlantSelect?: boolean; // Add prop to hide zone and plant selectors
  sendEmptyBu?: boolean; // Add prop to send empty bu in location API calls
  showLpgPackedAndBulk?: boolean; // Add prop to show LPG Packed and LPG Bulk options
}

const ReusableFilterBar: React.FC<ReusableFilterBarProps> = ({
  selectedBu,
  onBuChange,
  selectedZone,
  onZoneChange,
  selectedPlant,
  onPlantChange,
  onPlantDisplayNameChange,
  timeFilter,
  onTimeFilterChange,
  onRefresh,
  isLoading,
  refreshKey = 0, // Default value
  disableBuSelect = false, // Default to false
  hideBuSelect = false, // Default to false
  hideZonePlantSelect = false, // Default to false
  sendEmptyBu = false, // Default to false
  showLpgPackedAndBulk = false, // Default to false
}) => { 
  // Helper to get the correct BU for ZonePlantSelections
  const getBuForZonePlant = () => {
    if (selectedBu === 'SOD') return 'TAS';
    if (selectedBu === 'LPG_PACKED' || selectedBu === 'LPG_BULK') return 'LPG';
    return selectedBu;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {!hideBuSelect && (
          <Select value={selectedBu} onValueChange={onBuChange} disabled={disableBuSelect}>
            <SelectTrigger className="w-auto min-w-[5.5rem] h-7 text-xs shrink-0">
              <SelectValue placeholder="Select BU" />
            </SelectTrigger>
            <SelectContent className="z-[100]">
              <SelectItem value="TAS">SOD</SelectItem>
              {showLpgPackedAndBulk ? (
                <>
                  <SelectItem value="LPG_PACKED">LPG Packed</SelectItem>
                  <SelectItem value="LPG_BULK">LPG Bulk</SelectItem>
                </>
              ) : (
                <SelectItem value="LPG">LPG</SelectItem>
              )}
            </SelectContent>
          </Select>
        )}
        {!hideZonePlantSelect && (
          <ZonePlantSelections
            key={`zone-plant-${refreshKey}`} // Add key prop to force remount
            zone={selectedZone}
            sapid={selectedPlant}
            onZoneChange={onZoneChange}
            onPlantChange={onPlantChange}
            onPlantDisplayNameChange={onPlantDisplayNameChange}
            bu={getBuForZonePlant()}
            sendEmptyBu={sendEmptyBu}
            containerClassName="flex gap-1 shrink-0"
          />
        )}
      </div>
      <div className="flex items-center gap-2 ml-auto shrink-0">
        <EnhancedTimeFilter
          key={`time-filter-${refreshKey}`} // Add key prop to force remount
          selectedFilter={timeFilter}
          onFilterChange={onTimeFilterChange}
        />
        <Button
          onClick={onRefresh}
          disabled={isLoading}
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white p-1 px-2 rounded-md flex items-center gap-2 h-7 text-xs"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>
    </div>
  );
};

export default ReusableFilterBar;