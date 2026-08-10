import React, { useState } from 'react';
import { Card, CardContent } from "@/@/components/ui/card";
import FilterSidebar from './FilterSidebar';
import CompanyStatistics from './CompanyStatistics';
// import CompanyDistribution from './CompanyDistribution';
import IndiaMap from './indiamap';

const MapDashboard: React.FC = () => {
  const [filters, setFilters] = useState<any>({
    sbu: '',
    company: [],
    zone: '',
    state: '',
    district: '',
    location_name: ''
  });

  const handleFilterChange = (newFilters: any) => {
    console.log('Filters changed:', newFilters);
    setFilters(newFilters);
  };

  return (
    <div className="w-full h-full bg-gray-50 flex overflow-hidden p-1">
      {/* Single Card containing all sections */}
      <Card className="bg-grey border border-gray-200 shadow-lg rounded-lg hover:shadow-xl transition-shadow duration-300 w-full flex">
        <CardContent className="p-0 flex-1 flex overflow-hidden">
          {/* Left Sidebar - Company Statistics and Filters */}
          <div className="flex flex-col gap-1 h-full">
            {/* Company Statistics at top */}
            <div className="flex-shrink-0 p-2 pb-1">
              <CompanyStatistics />
            </div>
            {/* Filter Sidebar below */}
            <div className="flex-1 min-h-0">
              <FilterSidebar onFilterChange={handleFilterChange} />
            </div>
          </div>

          {/* Company Distribution - Commented out */}
          {/* <div className="w-80 flex flex-col gap-1.5 p-1 overflow-auto">
            <div className="flex flex-col gap-2 h-full">
              <div className="flex-shrink-0" style={{ minHeight: '350px' }}>
                <CompanyDistribution />
              </div>
            </div>
          </div> */}

          {/* Right Section - Map */}
          <div className="flex-1 p-1 min-w-0 overflow-hidden">
            <IndiaMap filters={filters} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MapDashboard;
