import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, X, ChevronRight } from 'lucide-react';
import { Button } from "../../../../@/components/ui/button";
import { ScrollArea } from "../../../../@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "../../../../@/components/ui/popover";
import { Badge } from "../../../../@/components/ui/badge";
import DebouncedApiCall from '../../../../DebouncedApiCall';
import { RootState } from '../../../../redux/store';
import { apiClient } from '@/services/apiClient';

interface FilterOptions {
  [category: string]: string[];
}

interface SelectedFilters {
  [category: string]: string[];
}

interface FilterComponentProps {
  onApplyFilters: (filters: SelectedFilters) => void;
  initialFilters: SelectedFilters;
}

const FilterComponent: React.FC<FilterComponentProps> = ({ onApplyFilters, initialFilters }) => {
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({});
  const [selectedFilters, setSelectedFilters] = useState<SelectedFilters>(initialFilters || {});
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const organizationId = useSelector((state: RootState) => state.organization.organizationId);

  const { data: apiData, loading, error, call: fetchFilterOptions } = DebouncedApiCall<{ status: boolean, data: FilterOptions }>({
    apiFunction: async () => {
      const response = await apiClient.post('/api/charts/get_distinct_values', {
        table: "alerts",
        column: ["cloud_provider", "priority", "alert_type", "resource_type", "recommendation_type"],
        where_cond: { organization_id: organizationId }
      });
      return response.data;
    },
    delay: 300,
    dependencies: [organizationId],
    onSuccess: (result) => {
      if (result.status && result.data) {
        setFilterOptions(result.data);
      } else {
        console.error("Unexpected API response structure:", result);
      }
    },
    onError: (error) => {
      console.error("Error fetching filter options:", error);
    }
  });

  useEffect(() => {
    if (organizationId) {
      fetchFilterOptions();
    }
  }, [organizationId]);

  const handleFilterChange = (category: string, value: string) => {
    setSelectedFilters(prev => {
      const updatedCategory = prev[category] ? [...prev[category]] : [];
      const valueIndex = updatedCategory.indexOf(value);
      if (valueIndex > -1) {
        updatedCategory.splice(valueIndex, 1);
      } else {
        updatedCategory.push(value);
      }
      return { ...prev, [category]: updatedCategory.length ? updatedCategory : undefined };
    });
  };

  const applyFilters = () => {
    const nonEmptyFilters = Object.fromEntries(
      Object.entries(selectedFilters).filter(([_, values]) => values && values.length > 0)
    );
    onApplyFilters(nonEmptyFilters);
    setIsOpen(false);
  };

  const clearAllFilters = () => {
    setSelectedFilters({});
  };

  const getSelectedFiltersCount = () => {
    return Object.values(selectedFilters).reduce((acc, curr) => acc + (curr ? curr.length : 0), 0);
  };

  return (
    <div className="relative">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            className="flex items-center gap-1 bg-[#0047AB] hover:bg-[#0047AB] text-white hover:text-white"
          >
            <Filter size={18} />
            Filters
            {getSelectedFiltersCount() > 0 && (
              <Badge variant="primary" className="bg-blue text-indigo-800 font-bold rounded-full px-2 py-0.5 text-xs">
                {getSelectedFiltersCount()}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-lg shadow-xl overflow-hidden"
          >
            <div className="p-4 border-b border-gray-200 bg-blue-400">
              <h2 className="text-lg font-semibold text-white">Filters</h2>
            </div>
            {loading ? (
              <div className="p-4 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto "></div>
                <p className="mt-2 text-gray-600">Loading filters...</p>
              </div>
            ) : (
              <ScrollArea className="h-[350px]">
                <AnimatePresence mode="wait">
                  {!activeCategory ? (
                    <motion.div
                      key="categories"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                    >
                      {Object.keys(filterOptions).map((category) => (
                        <Button
                          key={category}
                          variant="ghost"
                          className="w-full justify-between px-4 py-2 text-left text-gray-700 hover:bg-gray-100"
                          onClick={() => setActiveCategory(category)}
                        >
                          {category}
                          <ChevronRight size={18} />
                        </Button>
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div
                      key={activeCategory}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="p-4"
                    >
                      <div className="flex justify-between items-center mb-2">
  <h3 className="text-md font-semibold">{activeCategory}</h3>
  <Button
    variant="ghost"
    className="text-blue-600 text-xs"
    onClick={() => setActiveCategory(null)}
  >
    ← Back
  </Button>
</div>


                      {filterOptions[activeCategory]?.map((value) => (
                        <label key={value} className="flex items-center space-x-2 py-1">
                          <input
                            type="checkbox"
                            checked={selectedFilters[activeCategory]?.includes(value) || false}
                            onChange={() => handleFilterChange(activeCategory, value)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-gray-700">{value || "N/A"}</span>
                        </label>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </ScrollArea>
            )}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex space-x-2">
                <Button
                  variant="default"
                  onClick={applyFilters}
                  className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
                >
                  Apply
                </Button>
                <Button
                  variant="outline"
                  onClick={clearAllFilters}
                  className="flex-1 border-gray-300 text-gray-600 hover:bg-gray-100"
                >
                  Clear All
                </Button>
              </div>
            </div>
          </motion.div>
        </PopoverContent>
      </Popover>
      <AnimatePresence>
        {getSelectedFiltersCount() > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-2 flex flex-wrap gap-2"
          >
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FilterComponent;