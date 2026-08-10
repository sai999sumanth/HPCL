import React, { useEffect, useState } from "react";
import { setError } from "@/redux/features/askAISlice";
import { FilterDropdown } from "../FilterDropdown";
import { Button } from "@/@/components/ui/button";
import { RotateCcw, Loader2 } from "lucide-react";
import { apiClient } from "@/services/apiClient";

interface FilterOption {
  key: string;
  label: string;
}

// Props interface to receive callback from parent and handle reset
interface GlobalFilterProps {
  onFiltersChange: (activeFilters: any[], crossFilters: any[]) => void;
  onReset?: () => void; // New prop to handle reset in parent components
}

const filterOptions: FilterOption[] = [
  { key: "ZOName", label: "Zone" },
  { key: "ROName", label: "Region" },
  { key: "SAName", label: "Sales Area" },
  { key: "DistributorName", label: "Distributor" },
  { key: "StateCode", label: "State" },
  { key: "Financial_Year", label: "FinancialYear" },
];

const GlobalFilter = ({ onFiltersChange, onReset }: GlobalFilterProps) => {
  const [filterData, setFilterData] = useState<Record<string, string[]>>({});
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [activeFilters, setActiveFilters] = useState<Array<{
    key: string;
    cond: string;
    value: string;
  }>>([]);
  const [crossFilters, setCrossFilters] = useState<Array<{ 
    key: string;
    cond: string;
    value: string;
  }>>([]);
  const [isResetting, setIsResetting] = useState(false);
  
  const fetchFilterOptions = async (crossFilters = []) => {
    try {
      setIsLoadingFilters(true);
      const response = await apiClient.post("/api/charts/generate_vis_data", {
        filters: crossFilters,
        action: "cdcms_dropdown",
        drill_state: '',
      });

      if (!response.status) throw new Error(`HTTP error! status: ${response.status}`);

      const result = response.data;
      if (result) {
        setFilterData(result);
        const currentSelections = { ...selectedFilters };
        Object.keys(result).forEach((key) => {
          if (currentSelections[key] && !result[key].includes(currentSelections[key])) {
            currentSelections[key] = "";
          }
        });
        setSelectedFilters(currentSelections);
      }
    } catch (error) {
      console.error("Error fetching filter options:", error);
      setError(error instanceof Error ? error.message : "Failed to fetch filter options");
    } finally {
      setIsLoadingFilters(false);
    }
  };

  const handleFilterChange = async (key: string, value: string) => {
    setIsLoadingFilters(true);
    try {
      // Update local selected filters
      const updatedSelectedFilters = {
        ...selectedFilters,
        [key]: value === "NULL" ? "" : value
      };
      setSelectedFilters(updatedSelectedFilters);
      
      // Your existing filter change logic
      const newFilter = {
        key: `"${key}"`,
        cond: "equals",
        value: value,
      };

      let updatedFilters = [...activeFilters];
      const existingFilterIndex = updatedFilters.findIndex(
        (f) => f.key === `"${key}"`
      );

      if (value === "NULL") {
        updatedFilters = updatedFilters.filter((f) => f.key !== `"${key}"`);
      } else if (existingFilterIndex !== -1) {
        updatedFilters[existingFilterIndex] = newFilter;
      } else {
        updatedFilters.push(newFilter);
      }

      setActiveFilters(updatedFilters);
      setCrossFilters(updatedFilters);

      // Pass changes up to parent
      onFiltersChange(updatedFilters, updatedFilters);

      // Fetch updated filter options
      await fetchFilterOptions(updatedFilters);
    } catch (error) {
      console.error("Error updating filters:", error);
    } finally {
      setIsLoadingFilters(false);
    }
  };

  const resetFilters = async () => {
    setIsResetting(true);
    try {
      // Reset all state variables
      const resetValues = Object.keys(filterData).reduce(
        (acc, key) => {
          acc[key] = "";
          return acc;
        },
        {} as Record<string, string>
      );
      
      setSelectedFilters(resetValues);
      setActiveFilters([]);
      setCrossFilters([]);
      
      // Pass changes up to parent
      onFiltersChange([], []);
      
      // If parent has custom reset logic, call it
      if (onReset) {
        onReset();
      }
      
      // Fetch initial filter options
      await fetchFilterOptions([]);
    } catch (error) {
      console.error("Error resetting filters:", error);
    } finally {
      setIsResetting(false);
    }
  };

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-10 gap-1 pt-2 flex-grow">
        {filterOptions.map(({ key, label }) => (
          <FilterDropdown
            key={key}
            label={label}
            options={filterData[key] || []}
            value={selectedFilters[key] || ""}
            onChange={(value) => handleFilterChange(key, value)}
            isLoading={isLoadingFilters}
            buttonClassName="bg-purple-100"
            popoverClassName="bg-gray-50"
            buttonFontClassName="text-purple-600"
            selectedOptionClassName="bg-purple-200"          
          />
        ))}
      <Button
        onClick={resetFilters}
        disabled={isResetting || isLoadingFilters}
        className="text-white text-xs p-1 w-6 h-6 rounded-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
        >
        {isResetting ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <RotateCcw className="h-4 w-4" />
        )}
      </Button>
      </div>

    </div>
  );
};

export default GlobalFilter;