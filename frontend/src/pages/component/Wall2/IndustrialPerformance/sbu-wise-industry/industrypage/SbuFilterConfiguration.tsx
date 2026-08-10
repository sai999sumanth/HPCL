import React, { useState } from 'react';

interface FilterValues {
  product: string;
  zone: string;
  startMonth: number;
  endMonth: number;
  year: number;
}

interface SbuFilterConfigurationProps {
  onFilterChange: (values: FilterValues) => void;
}

const SbuFilterConfiguration: React.FC<SbuFilterConfigurationProps> = ({ onFilterChange }) => {
  const [filters, setFilters] = useState<FilterValues>({
    product: '',
    zone: '',
    startMonth: 1,
    endMonth: 12,
    year: 2024
  });

  const products = ['All Products', 'Petroleum', 'Natural Gas', 'Chemicals', 'Lubricants'];
  const zones = ['All Zones', 'North', 'South', 'East', 'West', 'Central'];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handleFilterChange = (key: keyof FilterValues, value: string | number) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md mb-4">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">Filter Configuration</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Product</label>
          <select
            value={filters.product}
            onChange={(e) => handleFilterChange('product', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {products.map(product => (
              <option key={product} value={product}>{product}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Zone</label>
          <select
            value={filters.zone}
            onChange={(e) => handleFilterChange('zone', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {zones.map(zone => (
              <option key={zone} value={zone}>{zone}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Start Month</label>
          <select
            value={filters.startMonth}
            onChange={(e) => handleFilterChange('startMonth', parseInt(e.target.value))}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {months.map((month, index) => (
              <option key={month} value={index + 1}>{month}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">End Month</label>
          <select
            value={filters.endMonth}
            onChange={(e) => handleFilterChange('endMonth', parseInt(e.target.value))}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {months.map((month, index) => (
              <option key={month} value={index + 1}>{month}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
          <select
            value={filters.year}
            onChange={(e) => handleFilterChange('year', parseInt(e.target.value))}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={2023}>2023-2024</option>
            <option value={2024}>2024-2025</option>
            <option value={2025}>2025-2026</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default SbuFilterConfiguration;
