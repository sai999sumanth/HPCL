import React from 'react';
import ZoneViolationHeatmap from './ZoneViolationHeatmap';
import MetricCard from './MetricCard';
import { Loader2 } from 'lucide-react';

interface TripSafetyRiskProps {
  selectedBu: string;
  totalViolations: number | null;
  totalViolationsLoading: boolean;
  totalViolationsError: boolean;
}

const TripSafetyRisk: React.FC<TripSafetyRiskProps> = ({ 
  selectedBu,
  totalViolations,
  totalViolationsLoading,
  totalViolationsError
}) => {

  const renderMetricValue = (
    loading: boolean, 
    error: boolean, 
    value: number | null
  ) => {
    if (loading) {
      return <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" />;
    }
    if (error || value === null) {
      return "N/A";
    }
    return value.toLocaleString();
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm w-full space-y-4">
      <h3 className="text-lg font-bold text-gray-900 px-2">Trip Safety Risk</h3>
      {/* Top Section: Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard 
          title="Total Violations" 
          value={renderMetricValue(totalViolationsLoading, totalViolationsError, totalViolations)} 
          variant="danger"
        />
        {/* <MetricCard 
          title="Avg. Risk Score" 
          value="65.2" 
          variant="warning"
        />
        <MetricCard 
          title="Cases Risk > Threshold Score" 
          value="28" 
          variant="danger"
        /> */}
      </div>

      {/* Bottom Section: Heatmap Chart */}
      <div>
        <ZoneViolationHeatmap selectedBu={selectedBu} queryType="trip_safety" />
      </div>
    </div>
  );
};

export default TripSafetyRisk;
