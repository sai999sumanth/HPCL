import { apiClient } from '@/services/apiClient';
import { Loader2 } from 'lucide-react';
import React, { useState, useEffect } from 'react';

const gradientStyles = [
"from-[#3B5DCB] via-[#3B5DCBcc] to-[#3B5DCB99]" ,// Muted Indigo
"from-[#8f72da] via-[#8f72dacc] to-[#8f72da99]", // Purple

  "from-[#0798be] via-[#0798becc] to-[#0798be99]",  // Teal
  "from-[#8f72da] via-[#8f72dacc] to-[#8f72da99]" ,  // Purple
  "from-[#FF007F] via-[#FF007Fcc] to-[#FF007F99]",  // Bright pink

];

const StatusCard = ({ title, statusData, totalCount, gradientIndex }) => {
  const gradient = gradientStyles[gradientIndex % gradientStyles.length];
  
  return (
    <div className={`group relative rounded-xl transition-all duration-300 w-full shadow-lg bg-gradient-to-br ${gradient}`}>
      <div className="relative p-3 space-y-1 text-gray-900 font-medium">
        {/* Header - reduced vertical spacing */}
        <div className="flex justify-between items-center border-b border-white/50 mb-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">{title}</h3>
          <div className="px-2 py-0.5 rounded-md text-sm font-bold text-white shadow-sm">
            {totalCount?.toLocaleString() || 0}
          </div>
        </div>
        
        {/* Status Items - reduced spacing and font size */}
        <div className="space-y-1">
          {Object.entries(statusData || {}).map(([key, count], index) => (
            <div key={index} className="flex justify-between items-center pb-0.5 text-xs">
              <p className="text-white">{key}</p>
              <div className="px-1.5 py-0.5 rounded bg-white/60 text-gray-900 font-semibold text-xs">
                {count?.toLocaleString() || 0}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface IndentStatusDashboardProps {
  filters?: any;
}

export default function IndentStatusDashboard({ filters }: IndentStatusDashboardProps) {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Convert filters to array format for API
        const filterArray: any[] = [];
        
        if (filters?.sodZoneName?.length > 0) {
          filters.sodZoneName.forEach(zone => {
            filterArray.push({ key: "zone", cond: "equals", value: zone });
          });
        }
        
        if (filters?.retailRegionName?.length > 0) {
          filters.retailRegionName.forEach(region => {
            filterArray.push({ key: "region", cond: "equals", value: region });
          });
        }
        
        if (filters?.retailAreaName?.length > 0) {
          filters.retailAreaName.forEach(area => {
            filterArray.push({ key: "sales_area", cond: "equals", value: area });
          });
        }
        
        if (filters?.retailCustomerName?.length > 0) {
          filters.retailCustomerName.forEach(customer => {
            filterArray.push({ key: "dealer_id", cond: "equals", value: customer });
          });
        }
        
        if (filters?.sodProductName?.length > 0) {
          filters.sodProductName.forEach(product => {
            filterArray.push({ key: "product_code", cond: "equals", value: product });
          });
        }
        
        if (filters?.categoryValue?.length > 0) {
          filterArray.push({ key: "category", cond: "equals", value: "R01" });
        }
        
        const response = await apiClient.post('/api/charts/generate_vis_data', {
            filters: filterArray,
            action: "dry_out_analysis_count",
            drill_state: ""
          });
        
        if (!response.status) {
          throw new Error('Network response was not ok');
        }
        
        const responseData = response.data;
        // Extract the data property from the response
        setDashboardData(responseData.data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };
    
    fetchData();
  }, [filters]);
  
  if (loading) return (
    <div className="flex justify-center items-center h-24">
      <Loader2 className="animate-spin text-blue-600" />
    </div>
  );
  
  if (error) return (
    <div className="p-2 bg-gray-50 text-gray-600 rounded-md text-sm">
      No Data
    </div>
  );
  
  if (!dashboardData) return null;
  
  // Dynamically create cards based on the available data keys
  // Filter out the totalCount key as it's not a card
  const dataKeys = Object.keys(dashboardData).filter(key => key !== 'totalCount');
  
  // Format the title function
  const formatTitle = (key) => {
    // Remove 'Data' suffix and convert camelCase to space-separated words
    return key
      .replace(/Data$/, '')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .toUpperCase();
  };
  
  return (
    <div className="p-0">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {dataKeys.map((key, index) => (
          <StatusCard
            key={key}
            title={formatTitle(key)}
            statusData={dashboardData[key]}
            totalCount={dashboardData.totalCount?.[key] || 0}
            gradientIndex={index}
          />
        ))}
      </div>
    </div>
  );
}