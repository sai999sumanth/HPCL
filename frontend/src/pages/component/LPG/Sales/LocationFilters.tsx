import React, { useState, useEffect } from 'react';
import { 
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/@/components/ui/select";
import { apiClient } from '@/services/apiClient';

interface FilterData {
  data: {
    ZOName: string[];
    ROName: string[];
    SAName: string[];
    JDEDistributorCode: string[];
  };
  status: boolean;
}

interface SelectedFilters {
  zone: string;
  region: string;
  sales_area: string;
  distributor: string;
}

const LocationFilters = ({ onFilterChange }: { onFilterChange: (filters: any) => void }) => {
  const [filterData, setFilterData] = useState({
    zone: [] as string[],
    region: [] as string[],
    sales_area: [] as string[],
    distributor: [] as string[]
  });
  
  const [selectedFilters, setSelectedFilters] = useState<SelectedFilters>({
    zone: 'all_zones',
    region: 'all_regions',
    sales_area: 'all_areas',
    distributor: 'all_distributors'
  });
  
  const [loading, setLoading] = useState(true);

  const fetchFilterData = async (whereCond = {}) => {
    try {
      setLoading(true);
      const response = await apiClient.post('/api/charts/get_distinct_values', {
          connection_id: "",
          schema: "public",
          table: "LPG_SALES_SUMMARY_DATA",
          column: ["ZOName", "ROName", "SAName", "JDEDistributorCode"],
          where_cond: whereCond
        });

      const responseData: FilterData = response.data;
      
      if (responseData.status) {
        setFilterData({
          zone: responseData.data.ZOName?.filter(z => z !== "") || [],
          region: responseData.data.ROName?.filter(r => r !== "") || [],
          sales_area: responseData.data.SAName?.filter(sa => sa !== "") || [],
          distributor: responseData.data.JDEDistributorCode?.filter(d => d !== "") || []
        });

        const newSelectedFilters = { ...selectedFilters };
        if (responseData.data.ZOName?.length === 1) {
          newSelectedFilters.zone = responseData.data.ZOName[0];
        }
        if (responseData.data.ROName?.length === 1) {
          newSelectedFilters.region = responseData.data.ROName[0];
        }
        setSelectedFilters(newSelectedFilters);
      }
    } catch (error) {
      console.error('Failed to fetch filter data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilterData();
  }, []);

  const handleFilterChange = async (value: string, filterType: keyof SelectedFilters) => {
    const newFilters = { ...selectedFilters, [filterType]: value };
    
    if (filterType === 'zone') {
      newFilters.region = 'all_regions';
      newFilters.sales_area = 'all_areas';
      newFilters.distributor = 'all_distributors';
    } else if (filterType === 'region') {
      newFilters.sales_area = 'all_areas';
      newFilters.distributor = 'all_distributors';
    } else if (filterType === 'sales_area') {
      newFilters.distributor = 'all_distributors';
    }

    setSelectedFilters(newFilters);
    
    const whereCond: Record<string, string> = {};
    if (newFilters.zone !== 'all_zones') whereCond.ZOName = newFilters.zone;
    if (newFilters.region !== 'all_regions') whereCond.ROName = newFilters.region;
    if (newFilters.sales_area !== 'all_areas') whereCond.SAName = newFilters.sales_area;
    if (newFilters.distributor !== 'all_distributors') whereCond.JDEDistributorCode = newFilters.distributor;

    await fetchFilterData(whereCond);
    onFilterChange(whereCond);
  };

  if (loading) {
    return <div className="flex items-center text-sm text-gray-500">Loading...</div>;
  }

  return (
    <div className="flex items-center gap-2">
      {/* Zone Filter */}
      <Select
        value={selectedFilters.zone}
        onValueChange={(value) => handleFilterChange(value, 'zone')}
      >
        <SelectTrigger className="w-32 h-8 text-xs">
          <SelectValue>
            {selectedFilters.zone === 'all_zones' ? (
              <span className="text-gray-500">Select Zone</span>
            ) : (
              selectedFilters.zone
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Zone</SelectLabel>
            <SelectItem value="all_zones">All Zones</SelectItem>
            {filterData.zone.map((zone) => (
              <SelectItem key={zone} value={zone}>
                {zone}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      {/* Region Filter */}
      <Select
        value={selectedFilters.region}
        onValueChange={(value) => handleFilterChange(value, 'region')}
      >
        <SelectTrigger className="w-36 h-8 text-xs">
          <SelectValue>
            {selectedFilters.region === 'all_regions' ? (
              <span className="text-gray-500">Select Region</span>
            ) : (
              selectedFilters.region
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Region</SelectLabel>
            <SelectItem value="all_regions">All Regions</SelectItem>
            {filterData.region.map((region) => (
              <SelectItem key={region} value={region}>
                {region}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      {/* Sales Area Filter */}
      <Select
        value={selectedFilters.sales_area}
        onValueChange={(value) => handleFilterChange(value, 'sales_area')}
      >
        <SelectTrigger className="w-40 h-8 text-xs">
          <SelectValue>
            {selectedFilters.sales_area === 'all_areas' ? (
              <span className="text-gray-500">Select Sales Area</span>
            ) : (
              selectedFilters.sales_area
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Sales Area</SelectLabel>
            <SelectItem value="all_areas">All Sales Areas</SelectItem>
            {filterData.sales_area.map((area) => (
              <SelectItem key={area} value={area}>
                {area}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      {/* Distributor Filter */}
      <Select
        value={selectedFilters.distributor}
        onValueChange={(value) => handleFilterChange(value, 'distributor')}
        disabled={!selectedFilters.sales_area || selectedFilters.sales_area === 'all_areas'}
      >
        <SelectTrigger className="w-40 h-8 text-xs">
          <SelectValue>
            {selectedFilters.distributor === 'all_distributors' ? (
              <span className="text-gray-500">Select Distributor</span>
            ) : (
              selectedFilters.distributor
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Distributor</SelectLabel>
            <SelectItem value="all_distributors">All Distributors</SelectItem>
            {filterData.distributor.map((dist) => (
              <SelectItem key={dist} value={dist}>
                {dist}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
};

export default LocationFilters;