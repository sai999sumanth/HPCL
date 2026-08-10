import React, { useState, useEffect } from 'react';


// Define the filter structure interface
interface FilterValues {
  product: string;
  zone: string;
  startMonth: number;
  endMonth: number;
  year: number;
}

interface PageFilterConfigurationProps {
  onFilterChange?: (filters: FilterValues) => void;
  initialFilters?: Partial<FilterValues>;
  className?: string;
}

const FilterConfiguration: React.FC<PageFilterConfigurationProps> = ({ 
  onFilterChange, 
  initialFilters = {},
  className = ""
}) => {
  // Sample data for dropdowns
  const products = ['Product A', 'Product B', 'Product C', 'Product D'];
  const zones = ['North America', 'Europe', 'Asia Pacific', 'Latin America', 'Middle East'];
  const months = [
    { value: 'JAN', label: 'JAN' },
    { value: 'FEB', label: 'FEB' },
    { value: 'MAR', label: 'MAR' },
    { value: 'APR', label: 'APR' },
    { value: 'MAY', label: 'MAY' },
    { value: 'JUN', label: 'JUN' },
    { value: 'JUL', label: 'JUL' },
    { value: 'AUG', label: 'AUG' },
    { value: 'SEP', label: 'SEP' },
    { value: 'OCT', label: 'OCT' },
    { value: 'NOV', label: 'NOV' },
    { value: 'DEC', label: 'DEC' }
];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  // State for filter values with proper typing
  const [filters, setFilters] = useState<FilterValues>({
    product: initialFilters.product || products[0],
    zone: initialFilters.zone || zones[0],
    startMonth: initialFilters.startMonth || 1,
    endMonth: initialFilters.endMonth || 12,
    year: initialFilters.year || currentYear
  });

  // Update parent component when filters change
  useEffect(() => {
    if (onFilterChange) {
      onFilterChange(filters);
    }
  }, [filters]);



  // Handle filter changes
  const handleFilterChange = (key: keyof FilterValues, value: string | number) => {
    setFilters(prev => {
      // Type guard to ensure proper typing
      if (key === 'startMonth' && typeof value === 'number' && value > prev.endMonth) {
        return { ...prev, [key]: value, endMonth: value };
      }
      if (key === 'endMonth' && typeof value === 'number' && value < prev.startMonth) {
        return { ...prev, [key]: value, startMonth: value };
      }
      return { ...prev, [key]: value };
    });
  };

  return (
    <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Product dropdown */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Product
          </label>
          <select
            value={filters.product}
            onChange={(e) => handleFilterChange('product', e.target.value)}
            className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {products.map((product) => (
              <option key={product} value={product}>
                {product}
              </option>
            ))}
          </select>
        </div>

        {/* Zone dropdown */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Zone
          </label>
          <select
            value={filters.zone}
            onChange={(e) => handleFilterChange('zone', e.target.value)}
            className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </div>

        {/* Start Month dropdown */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Month
          </label>
          <select
            value={filters.startMonth}
            onChange={(e) => handleFilterChange('startMonth', parseInt(e.target.value))}
            className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {months.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </div>

        {/* End Month dropdown */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Month
          </label>
          <select
            value={filters.endMonth}
            onChange={(e) => handleFilterChange('endMonth', parseInt(e.target.value))}
            className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {months.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </div>

        {/* Year dropdown */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Year
          </label>
          <select
            value={filters.year}
            onChange={(e) => handleFilterChange('year', parseInt(e.target.value))}
            className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default FilterConfiguration;