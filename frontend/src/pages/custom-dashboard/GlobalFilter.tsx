// import React, { createContext, useState, useContext, useMemo } from 'react';
// import { Card, CardContent, CardHeader, CardTitle } from '../../@/components/ui/card';
// import { X } from 'lucide-react';
// import { MultiSelect } from './multi-select/multi-select'; // Update this import path
// import { Bar, BarChart, Legend, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
// import { Label } from '../../@/components/ui/label';
// import { Tooltip as ShadcnTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../@/components/ui/tooltip';
// import AlertPage from './AlertPage';

// // Filter Context for Global State Management

// interface FilterContextType {
//   filters: Record<string, string[]>; // Object with string keys and string[] values
//   clearFilter: (key: string) => void;
//   clearAllFilters: () => void;
//   updateFilter: (filterName: string, values: string[]) => void;
// }

// const FilterContext = React.createContext<FilterContextType | null>(null);

// interface FilterValue {
//   [key: string]: string[];
// }

// // Reusable Filter Data
// const FILTER_OPTIONS = {
//   city: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'],
//   district: ['Downtown', 'Midtown', 'Uptown', 'Suburbs', 'Industrial'],
//   state: ['NY', 'CA', 'IL', 'TX', 'AZ'],
//   country: ['USA', 'Canada', 'Mexico', 'UK', 'Australia']
// };

// // Utility function to generate chart data
// const generateChartData = (filters: Record<string, string[]>) => ({
//   salesData: [
//     { name: 'Jan', [filters.city?.[0] || 'Default']: 400, [filters.district?.[0] || 'Default']: 240 },
//     { name: 'Feb', [filters.city?.[0] || 'Default']: 300, [filters.district?.[0] || 'Default']: 139 },
//     { name: 'Mar', [filters.city?.[0] || 'Default']: 200, [filters.district?.[0] || 'Default']: 980 },
//   ],
//   userGrowthData: [
//     { name: 'Q1', [filters.state?.[0] || 'Default']: 4000, [filters.country?.[0] || 'Default']: 2400 },
//     { name: 'Q2', [filters.state?.[0] || 'Default']: 3000, [filters.country?.[0] || 'Default']: 1398 },
//     { name: 'Q3', [filters.state?.[0] || 'Default']: 2000, [filters.country?.[0] || 'Default']: 9800 },
//   ],
//   revenueData: [
//     { name: 'Region', [filters.district?.[0] || 'Default']: 4000, [filters.city?.[0] || 'Default']: 2400 },
//     { name: 'National', [filters.district?.[0] || 'Default']: 3000, [filters.city?.[0] || 'Default']: 1398 },
//     { name: 'Global', [filters.district?.[0] || 'Default']: 2000, [filters.city?.[0] || 'Default']: 9800 },
//   ]
// });

// // Global Filter Provider Component
// export const GlobalFilterProvider = ({ children }: { children: React.ReactNode }) => {
//   const [filters, setFilters] = useState<Record<string, string[]>>({
//     city: [],
//     district: [],
//     state: [],
//     country: []
//   });

//   const updateFilter = (filterName: string, values: string[]) => {
//     setFilters(prev => ({
//       ...prev,
//       [filterName]: values
//     }));
//   };

//   const clearFilter = (filterName: string) => {
//     setFilters(prev => ({
//       ...prev,
//       [filterName]: []
//     }));
//   };

//   const clearAllFilters = () => {
//     setFilters({
//       city: [],
//       district: [],
//       state: [],
//       country: []
//     });
//   };

//   return (
//     <FilterContext.Provider value={{ filters, updateFilter, clearFilter, clearAllFilters }}>
//       {children}
//     </FilterContext.Provider>
//   );
// };

// // Selected Filters Component
// const SelectedFilters = () => {
//   const context = useContext(FilterContext);
//   if (!context) return null;
//   const { filters, clearFilter, clearAllFilters } = context;

//   const formatFilterValues = (key: string, values: string[]) => {
//     const allOptions = FILTER_OPTIONS[key];
    
//     // Show "All" if all values are selected
//     if (values.length === allOptions.length) {
//       return { displayText: 'All', tooltip: null };
//     }
    
//     // Show up to 3 values directly
//     if (values.length <= 3) {
//       return { displayText: values.join(', '), tooltip: null };
//     }
    
//     // Show first 2 values + count for remaining
//     const displayValues = values.slice(0, 2);
//     const remaining = values.slice(2);
//     return {
//       displayText: `${displayValues.join(', ')} +${remaining.length}`,
//       tooltip: remaining.join(', ')
//     };
//   };

//   const groupedFilters = Object.entries(filters)
//     .filter(([_, values]) => values.length > 0)
//     .map(([key, values]) => ({
//       key: key.charAt(0).toUpperCase() + key.slice(1),
//       ...formatFilterValues(key.toLowerCase(), values)
//     }));

//   if (groupedFilters.length === 0) return null;

//   return (
//     <div className="bg-gray-50 rounded-lg p-2 mt-0 border border-gray-200 shadow-sm">
//       <div className="flex justify-between items-center mb-3">
//         <h3 className="text-sm font-semibold text-gray-700">
//           Selected Filters
//         </h3>
//         <button 
//           onClick={clearAllFilters}
//           className="text-xs text-red-600 hover:text-red-800 flex items-center"
//         >
//           Clear All
//           <X className="ml-1 h-4 w-4" />
//         </button>
//       </div>
//       <div className="flex flex-wrap gap-2">
//         {groupedFilters.map(({ key, displayText, tooltip }) => (
//           <TooltipProvider key={key}>
//             <div className="flex items-center bg-white border rounded-full px-3 py-1 text-sm shadow-sm">
//               <span className="mr-2 text-gray-600 font-medium">
//                 {key}:
//               </span>
//               {tooltip ? (
//                 <ShadcnTooltip>
//                   <TooltipTrigger className="text-gray-800 mr-2">
//                     {displayText}
//                   </TooltipTrigger>
//                   <TooltipContent>
//                     <p>Also includes: {tooltip}</p>
//                   </TooltipContent>
//                 </ShadcnTooltip>
//               ) : (
//                 <span className="text-gray-800 mr-2">
//                   {displayText}
//                 </span>
//               )}
//               <button 
//                 onClick={() => clearFilter(key.toLowerCase())}
//                 className="text-gray-500 hover:text-gray-700"
//               >
//                 <X className="h-4 w-4" />
//               </button>
//             </div>
//           </TooltipProvider>
//         ))}
//       </div>
//     </div>
//   );
// };

// // Global Filter Component
// const GlobalFilter = () => {
//   const { filters, updateFilter } = useContext(FilterContext);
//   const [isOpen, setIsOpen] = useState(false);

//   const selectedFiltersCount: any = Object.values(filters).reduce((acc, curr: any) => acc + curr.length, 0);

//   return (
//     <div className="border rounded-lg shadow-sm">
//       <div 
//         className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50 transition-colors"
//         onClick={() => setIsOpen(!isOpen)}
//       >
//         <div className="flex items-center space-x-3">
//           <span className="font-semibold text-gray-800">Global Filters</span>
//           {selectedFiltersCount > 0 && (
//             <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
//               {selectedFiltersCount} Selected
//             </span>
//           )}
//         </div>
//         <svg 
//           xmlns="http://www.w3.org/2000/svg" 
//           className={`h-5 w-5 text-gray-600 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
//           viewBox="0 0 24 24" 
//           fill="none" 
//           stroke="currentColor"
//         >
//           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
//         </svg>
//       </div>

//       {isOpen && (
//         <div className="p-4 border-t">
//           <div className="grid grid-cols-4 gap-2">
//             {Object.keys(FILTER_OPTIONS).map(filterName => (
//               <div key={filterName} className="w-full">
//                 <Label htmlFor={filterName} className="text-sm font-medium text-gray-600">
//                   {filterName.charAt(0).toUpperCase() + filterName.slice(1)}
//                 </Label>
//                 <MultiSelect
//                   options={FILTER_OPTIONS[filterName].map(option => ({ 
//                     label: option, 
//                     value: option 
//                   }))}
//                   onValueChange={(values) => updateFilter(filterName, values)}
//                   defaultValue={filters[filterName]}
//                   placeholder={`Select ${filterName.charAt(0).toUpperCase() + filterName.slice(1)}`}
//                   maxCount={1}
//                 />
//               </div>
//             ))}
//           </div>
//         </div>
//       )}

//       {!isOpen && <SelectedFilters />}
//     </div>
//   );
// };


// // Reusable Chart Component
// const FilteredBarChart = ({ 
//   title, 
//   data, 
//   primaryKey, 
//   secondaryKey 
// }: { 
//   title: string, 
//   data: any[], 
//   primaryKey: string, 
//   secondaryKey: string 
// }) => {
//   const { filters } = useContext(FilterContext);

//   return (
//     <Card>
//       <CardHeader>
//         <CardTitle>{title}</CardTitle>
//       </CardHeader>
//       <CardContent>
//         <ResponsiveContainer width="100%" height={300}>
//           <BarChart data={data}>
//             <XAxis dataKey="name" />
//             <YAxis />
//             <Tooltip />
//             <Legend />
//             <Bar 
//               dataKey={filters[primaryKey]?.[0] || 'Default'} 
//               fill="#8884d8" 
//             />
//             <Bar 
//               dataKey={filters[secondaryKey]?.[0] || 'Default'} 
//               fill="#82ca9d" 
//             />
//           </BarChart>
//         </ResponsiveContainer>
//       </CardContent>
//     </Card>
//   );
// };

// // Main Dashboard Component
// const GlobalFilterDashboard = () => {
//   const { filters } = useContext(FilterContext);
//   const chartData = generateChartData(filters);

//   return (
//     <div className="p-4 space-y-4">
//       <div className="grid grid-cols-3 gap-4">
//         <FilteredBarChart 
//           title="Sales Chart" 
//           data={chartData.salesData}
//           primaryKey="city"
//           secondaryKey="district"
//         />
//         <FilteredBarChart 
//           title="User Growth Chart" 
//           data={chartData.userGrowthData}
//           primaryKey="state"
//           secondaryKey="country"
//         />
//         <FilteredBarChart 
//           title="Revenue Chart" 
//           data={chartData.revenueData}
//           primaryKey="district"
//           secondaryKey="city"
//         />
//       </div>
//     </div>
//   );
// };

// // Wrapper Component to Provide Context
// const ChartWrapper = () => {
//   return (
//     <GlobalFilterProvider>
//       <GlobalFilter />
//       {/* <GlobalFilterDashboard /> */}
//       {/* <AlertPage /> */}
//     </GlobalFilterProvider>
//   );
// };

// export default ChartWrapper;









import React, { createContext, useState, useContext, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../@/components/ui/card';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { MultiSelect } from './multi-select/multi-select';
import { Bar, BarChart, Legend, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { Label } from '../../@/components/ui/label';
import { Tooltip as ShadcnTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../@/components/ui/tooltip';
import filtersConfigs from './charts/filtersConfig.json'; // Dynamic filter config
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../@/components/ui/select";
interface FilterContextType {
  filters: Record<string, string[]>;
  clearFilter: (key: string) => void;
  clearAllFilters: () => void;
  updateFilter: (filterName: string, values: string[]) => void;
}

const FilterContext = React.createContext<FilterContextType | null>(null);

// Utility function to generate chart data dynamically

// Global Filter Provider Component
export const GlobalFilterProvider = ({ children }: { children: React.ReactNode }) => {
  // Initialize filters based on the dynamic configuration
  const initialFilters = useMemo(
    () =>
      filtersConfigs.reduce((acc, config) => {
        acc[config.key] = [];
        return acc;
      }, {} as Record<string, string[]>),
    []
  );

  const [filters, setFilters] = useState<Record<string, string[]>>(initialFilters);

  // Function to generate filter options dynamically
  function generateFilterOptions(configs) {
    const filterOptions = {};
    configs.forEach(item => {
      filterOptions[item.key] = item.options.map(option => option.value);
    });
    return filterOptions;
  }
  const generateChartData = (filters: Record<string, string[]>) => {
    const dynamicChartData = {
      salesData: [
        { name: 'Jan', [filters.city?.[0] || 'Default']: 400, [filters.district?.[0] || 'Default']: 240 },
        { name: 'Feb', [filters.city?.[0] || 'Default']: 300, [filters.district?.[0] || 'Default']: 139 },
        { name: 'Mar', [filters.city?.[0] || 'Default']: 200, [filters.district?.[0] || 'Default']: 980 },
      ],
      userGrowthData: [
        { name: 'Q1', [filters.state?.[0] || 'Default']: 4000, [filters.country?.[0] || 'Default']: 2400 },
        { name: 'Q2', [filters.state?.[0] || 'Default']: 3000, [filters.country?.[0] || 'Default']: 1398 },
        { name: 'Q3', [filters.state?.[0] || 'Default']: 2000, [filters.country?.[0] || 'Default']: 9800 },
      ],
      revenueData: [
        { name: 'Region', [filters.district?.[0] || 'Default']: 4000, [filters.city?.[0] || 'Default']: 2400 },
        { name: 'National', [filters.district?.[0] || 'Default']: 3000, [filters.city?.[0] || 'Default']: 1398 },
        { name: 'Global', [filters.district?.[0] || 'Default']: 2000, [filters.city?.[0] || 'Default']: 9800 },
      ]
    };
  
    return dynamicChartData;
  };
  
  const FILTER_OPTIONS = generateFilterOptions(filtersConfigs);

  const updateFilter = (filterName: string, values: string[]) => {
    if (!FILTER_OPTIONS[filterName]) {
      console.error(`Filter "${filterName}" does not exist in FILTER_OPTIONS.`);
      return;
    }
    setFilters((prev) => {
      const updatedFilters = {
        ...prev,
        [filterName]: values,
      };
      console.log('Updated Filters:', updatedFilters);
      return updatedFilters;
    });
  };

  const clearFilter = (filterName: string) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: []
    }));
  };

  const clearAllFilters = () => {
    setFilters(initialFilters);
  };

  return (
    <FilterContext.Provider value={{ filters, updateFilter, clearFilter, clearAllFilters }}>
      {children}
    </FilterContext.Provider>
  );
};

// Selected Filters Component
const SelectedFilters = () => {
  const context = useContext(FilterContext);
  if (!context) return null;
  const { filters, clearFilter, clearAllFilters } = context;

  const formatFilterValues = (key: string, values: string[]) => {
    const filterConfig = filtersConfigs.find(config => config.key === key);
    const allOptions = filterConfig?.options.map(opt => opt.value) || [];

    if (values.length === allOptions.length) {
      return { displayText: 'All', tooltip: null };
    }

    if (values.length <= 3) {
      return { displayText: values.join(', '), tooltip: null };
    }

    const displayValues = values.slice(0, 2);
    const remaining = values.slice(2);
    return {
      displayText: `${displayValues.join(', ')} +${remaining.length}`,
      tooltip: remaining.join(', ')
    };
  };

  const groupedFilters = Object.entries(filters)
    .filter(([_, values]) => values.length > 0)
    .map(([key, values]) => {
      const config = filtersConfigs.find(config => config.key === key);
      return {
        key: config?.label || key,
        ...formatFilterValues(key, values)
      };
    });

  if (groupedFilters.length === 0) return null;

  return (
    <div className="bg-gray-50 rounded-lg p-1 border border-gray-200 shadow-sm">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xs font-medium text-gray-700">Selected Filters</h3>
        <button
          onClick={clearAllFilters}
          className="text-xs text-red-600 hover:text-red-800 flex items-center"
        >
          Clear All
          <X className="ml-1 h-3 w-3" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {groupedFilters.map(({ key, displayText, tooltip }) => (
          <TooltipProvider key={key}>
            <div className="flex items-center bg-white border rounded-full px-2 py-0.5 text-xs shadow-sm">
              <span className="mr-1 text-gray-600 font-medium">{key}:</span>
              {tooltip ? (
                <ShadcnTooltip>
                  <TooltipTrigger className="text-gray-800 mr-1">
                    {displayText}
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Also includes: {tooltip}</p>
                  </TooltipContent>
                </ShadcnTooltip>
              ) : (
                <span className="text-gray-800 mr-1">{displayText}</span>
              )}
              <button
                onClick={() => clearFilter(key.toLowerCase())}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </TooltipProvider>
        ))}
      </div>
    </div>
  );
};

// Global Filter Component
const GlobalFilter = () => {
  const { filters, updateFilter } = useContext(FilterContext);
  const [isOpen, setIsOpen] = useState(true);

  const selectedFiltersCount = Object.values(filters).reduce((acc, curr) => acc + curr.length, 0);

  return (
    <div>
      <div className="border rounded-lg shadow-sm">
        <div
          className="flex justify-between items-center p-3 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex items-center space-x-2">
            <span className="font-medium text-gray-800 text-xs">Global Filters</span>
            {selectedFiltersCount > 0 && (
              <span className="bg-blue-100 text-blue-800 text-xxs px-1 py-0.5 rounded-full">
                {selectedFiltersCount} Selected
              </span>
            )}
          </div>
          <div>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-gray-600" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-600" />
            )}
          </div>
        </div>
        {isOpen && (
          <div className="p-3 border-t">
            <div className="grid grid-cols-4 gap-1">
              {filtersConfigs.map((filterConfig, index) => {
                const { type, placeholder, label, key, options } = filterConfig;

                if (type === 'multi-select') {
                  return (
                    <div key={index} className="w-full">
                      <Label htmlFor={label} className="text-xs font-medium text-gray-600">
                        {label}
                      </Label>
                      <MultiSelect
                        options={options}
                        onValueChange={(values) => updateFilter(key, values)}
                        defaultValue={filters[key]}
                        placeholder={placeholder}
                      />
                    </div>
                  );
                }
                if (type === 'select') {
                  return (
                    <div key={index} className="w-full">
                      <Label htmlFor={label} className="text-xs font-medium text-gray-600">
                        {label}
                      </Label>
                      <Select
                        onValueChange={(value) => updateFilter(key, [value])}
                        value={filters[key]?.[0] || ''}
                      >
                        <SelectTrigger className="border rounded-lg p-2 w-full">
                          <SelectValue placeholder={placeholder} />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>
        )}
      </div>

      {!isOpen && selectedFiltersCount > 0 && (
        <div className="mt-2">
          <SelectedFilters />
        </div>
      )}
    </div>
  );
};

// Wrapper Component to Provide Context
const ChartWrapper = () => {
  return (
    <GlobalFilterProvider>
      <GlobalFilter />
      {/* SelectedFilters is now conditionally rendered within GlobalFilter */}
    </GlobalFilterProvider>
  );
};

export default ChartWrapper;