
"use client"
import { FilterDropdown } from "../../Sales/FilterDropdown"
import useAuthStore from '@/store/authStore';

interface FilterOption {
  key: string
  label: string
}

interface PlantOption {
  label: string
  value: string
  sap_id: string
  location_name: string
}

interface LPGOperationsFiltersProps {
  filterOptions: FilterOption[]
  filterData: Record<string, string[] | PlantOption[]>
  selectedFilters: Record<string, string>
  isLoadingFilters: boolean
  onFilterChange: (key: string, value: string) => void
  drillHistory?: string[]
}

const LPGOperationsFilters = ({
  filterOptions,
  filterData,
  selectedFilters,
  isLoadingFilters,
  onFilterChange,
  drillHistory = [],
}: LPGOperationsFiltersProps) => {
  const { user } = useAuthStore();

  // Helper function to process options based on filter type
  const getFilterOptions = (key: string) => {
    const rawData = filterData[key] || []
    
    // Check if this is plant data (array of objects with sap_id)
    if (key === "plant" && rawData.length > 0 && typeof rawData[0] === 'object' && 'sap_id' in rawData[0]) {
      // For plant dropdown, return array of objects with value and label
      const opts = (rawData as PlantOption[])
        .filter((option) => option.sap_id && option.location_name)
        .map((option) => ({
          value: option.sap_id,           // Send sap_id to backend
          label: option.location_name     // Display location_name
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
      return [{ value: '', label: 'All Plants' }, ...opts];
    }

    // Zone filter: if user has zone: [] (empty) or no zone → show all zones; if user has specific zones → show only those
    if (key === "zone") {
      const allZones = (rawData as string[])
        .filter((option) => option !== null && option !== "")
        .sort();
      const userZones = Array.isArray(user?.zone) ? user.zone : [];
      if (userZones.length === 0) {
        return [{ value: '', label: 'All Zones' }, ...allZones];
      }
        const filtered = allZones.filter((z) => userZones.some((uz: string) => String(uz).trim() === String(z).trim()));
        return [{ value: '', label: 'All Zones' }, ...filtered];
    }
    
    // For other filters (region, etc.), return simple string array
    const arr = (rawData as string[])
      .filter((option) => option !== null && option !== "")
      .sort();
    return [{ value: '', label: 'All' }, ...arr];
  }

  return (
    <div className="flex flex-row items-center justify-start gap-2">
      <div className="flex flex-row items-center gap-2 flex-wrap">
        {filterOptions.map(({ key, label }) => {
          const processedOptions = getFilterOptions(key)
          return (
            <div key={key} className="w-[88px] min-w-[72px] max-w-[100px]">
              <FilterDropdown
                label={label}
                options={processedOptions}
                value={selectedFilters[key] || ""}
                onChange={(value) => onFilterChange(key, value)}
                isLoading={isLoadingFilters}
                buttonClassName="bg-gray-100"
                popoverClassName="bg-gray-50"
                buttonFontClassName="text-gray-800"
                selectedOptionClassName="bg-gray-200"
              />
            </div>
          )
        })}
      </div>
  
      {drillHistory.length > 0 && (
        <div className="text-gray-600 p-1 text-xs text-center">
          Drill Path: {drillHistory.join(" → ")}
        </div>
      )}
    </div>
  )
}  
export default LPGOperationsFilters