import React from 'react';
import ReusableFilterBar from '../../Governance/VTS Analytics/ReusableFilterBar';

interface CEMSHeaderProps {
  selectedBu: string;
  onBuChange: (bu: string) => void;
  selectedZone: string | null;
  onZoneChange: (zone: string | null) => void;
  selectedPlant: string | null;
  onPlantChange: (plant: string | null, zone: string | null) => void;
  onPlantDisplayNameChange?: (plantName: string | null) => void;
  timeFilter: string | null | { key: string; cond: string; value: string };
  onTimeFilterChange: (filter: string | null | { key: string; cond: string; value: string }) => void;
  onRefresh: () => void;
  isLoading: boolean;
  refreshKey?: number;
}

const CEMSHeader: React.FC<CEMSHeaderProps> = ({
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
  refreshKey = 0,
}) => {
  // Pass through the filter directly
  const handleTimeFilterChange = (filter: string | null | { key: string; cond: string; value: string }) => {
    onTimeFilterChange(filter);
  };

  return (
    <div className="space-y-2">
      {/* Header Box - matches VTS Dashboard style */}
      <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">HPCL Solar Performance Monitor</h1>
            <p className="text-sm text-gray-600">
              Solar Performance Monitoring - CEMS Dashboard
            </p>
          </div>
          <ReusableFilterBar
            key={refreshKey}
            refreshKey={refreshKey}
            selectedBu={selectedBu}
            onBuChange={onBuChange}
            selectedZone={selectedZone}
            onZoneChange={onZoneChange}
            selectedPlant={selectedPlant}
            onPlantChange={onPlantChange}
            onPlantDisplayNameChange={onPlantDisplayNameChange}
            timeFilter={timeFilter as string | null}
            onTimeFilterChange={handleTimeFilterChange}
            onRefresh={onRefresh}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
};

export default CEMSHeader;
