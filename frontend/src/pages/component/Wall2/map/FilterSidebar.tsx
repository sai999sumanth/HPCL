import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, Building2, X, Upload, Globe, Map, MapPin, Search as SearchIcon, Check } from 'lucide-react';
import { apiClient } from '../../../../services/apiClient';
import UploadDialog, { type UploadStatus } from './UploadDialog';

interface FilterSidebarProps {
  onFilterChange?: (filters: any) => void;
}

type FilterType = 'sbu' | 'company' | 'zone' | 'state' | 'district' | 'location_name';

const FilterSidebar: React.FC<FilterSidebarProps> = ({ onFilterChange }) => {
  const [selectedFilters, setSelectedFilters] = useState<Record<FilterType, string[] | string>>({
    sbu: '',
    company: [],
    zone: '',
    state: '',
    district: '',
    location_name: ''
  });
  const [filterOptions, setFilterOptions] = useState<Record<FilterType, string[]>>({
    sbu: [],
    company: [],
    zone: [],
    state: [],
    district: [],
    location_name: []
  });
  // Cached options - stores the complete list of options for display
  const [cachedOptions, setCachedOptions] = useState<Record<FilterType, string[]>>({
    sbu: [],
    company: [],
    zone: [],
    state: [],
    district: [],
    location_name: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [hasLoadedFilters, setHasLoadedFilters] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState<Record<FilterType, boolean>>({
    sbu: false,
    company: false,
    zone: false,
    state: false,
    district: false,
    location_name: false
  });
  const [searchQueries, setSearchQueries] = useState<Record<FilterType, string>>({
    sbu: '',
    company: '',
    zone: '',
    state: '',
    district: '',
    location_name: ''
  });

  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    isUploading: false,
    success: false,
    error: null,
    fileName: null,
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const VALID_SBUS = ['sod', 'lpg', 'lubes', 'aviation'];
  const getUploadEndpoint = useCallback((sbu: string) => {
    const sbuLower = sbu?.toLowerCase() || '';
    const endpoints: Record<string, string> = {
      lpg: '/api/lpginfra/upload_lpg_file',
      sod: '/api/sodinfra/upload_sod_file',
      lubes: '/api/lubesinfra/upload_lubes_file',
      aviation: '/api/aviationinfra/upload_aviation_file',
    };
    return endpoints[sbuLower] || endpoints.sod;
  }, []);

  const canUpload = useCallback(() => {
    const sbu = typeof selectedFilters.sbu === 'string' ? selectedFilters.sbu : '';
    return !!sbu && VALID_SBUS.includes(sbu.toLowerCase());
  }, [selectedFilters.sbu]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const sbu = typeof selectedFilters.sbu === 'string' ? selectedFilters.sbu : '';
      if (!sbu || !VALID_SBUS.includes(sbu.toLowerCase())) {
        setUploadStatus({ isUploading: false, success: false, error: 'Invalid SBU for upload', fileName: file.name });
        return;
      }
      setUploadStatus({ isUploading: true, success: false, error: null, fileName: file.name });
      const formData = new FormData();
      formData.append('file', file);
      const uploadEndpoint = getUploadEndpoint(sbu);
      try {
        const response = await fetch(uploadEndpoint, { method: 'POST', body: formData });
        if (!response.ok) throw new Error(`Upload failed - Status ${response.status}`);
        await response.json();
        setUploadStatus({ isUploading: false, success: true, error: null, fileName: file.name });
        if (onFilterChange) onFilterChange(selectedFilters);
      } catch (err: any) {
        setUploadStatus({
          isUploading: false,
          success: false,
          error: err?.message || 'Upload failed',
          fileName: file.name,
        });
      }
    },
    [selectedFilters, getUploadEndpoint, onFilterChange]
  );

  const resetUploadStatus = useCallback(() => {
    setUploadStatus({ isUploading: false, success: false, error: null, fileName: null });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // Build payload from current filter selections
  const buildPayload = useCallback(() => {
    const payload = {
      sbu: typeof selectedFilters.sbu === 'string' && selectedFilters.sbu ? selectedFilters.sbu : "",
      company: Array.isArray(selectedFilters.company) ? selectedFilters.company : [],
      zone: typeof selectedFilters.zone === 'string' && selectedFilters.zone ? [selectedFilters.zone] : [],
      state: typeof selectedFilters.state === 'string' && selectedFilters.state ? [selectedFilters.state] : [],
      district: typeof selectedFilters.district === 'string' && selectedFilters.district ? [selectedFilters.district] : [],
      location_name: typeof selectedFilters.location_name === 'string' && selectedFilters.location_name ? [selectedFilters.location_name] : []
    };
    // console.log('FilterSidebar - buildPayload:', payload);
    return payload;
  }, [selectedFilters]);

  // Fetch initial filter options (without any filters) on mount
  useEffect(() => {
    const fetchInitialOptions = async () => {
      setIsLoading(true);
      try {
        const payload = {
          sbu: "",
          company: [],
          zone: [],
          state: [],
          district: [],
          location_name: []
        };

        const response = await apiClient.post('/api/sodinfra/get_distinct_sod_lpg_infra', payload);
        const data = response.data?.data || response.data || {};
        
        const initialOptions = {
          sbu: data.sbu || [],
          company: data.company || [],
          zone: data.zone || [],
          state: data.state || [],
          district: data.district || [],
          location_name: data.location_name || []
        };
        
        // Store in both filterOptions and cachedOptions
        setFilterOptions(initialOptions);
        setCachedOptions(initialOptions);
        setIsInitialLoad(false);
        setHasLoadedFilters(true);
      } catch (error) {
        console.error('Error fetching initial filter options:', error);
        setIsInitialLoad(false);
      } finally {
        setIsLoading(false);
      }
    };

    if (isInitialLoad) {
      fetchInitialOptions();
    }
  }, [isInitialLoad]);

  // Fetch filter options from API based on current selections (for cascading)
  useEffect(() => {
    // Skip if initial load hasn't completed
    if (isInitialLoad) return;

    const fetchFilterOptions = async () => {
      setIsLoading(true);
      try {
        const payload = buildPayload();

        const response = await apiClient.post('/api/sodinfra/get_distinct_sod_lpg_infra', payload);
        const data = response.data?.data || response.data || {};
        
        console.log('FilterSidebar - API Response:', data);
        
        // Update filterOptions with API response for cascading filters
        // Always use the API response data, even if empty (empty means no options match the filter)
        const newFilterOptions = {
          sbu: data.sbu || [],
          company: data.company || [],
          zone: data.zone || [],
          state: data.state || [],
          district: data.district || [],
          location_name: data.location_name || []
        };
        
        console.log('FilterSidebar - Setting filterOptions:', newFilterOptions);
        setFilterOptions(newFilterOptions);
      } catch (error) {
        console.error('Error fetching filter options:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFilterOptions();
  }, [selectedFilters, isInitialLoad, buildPayload]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Don't close if clicking inside the dropdown container or on a checkbox/checkmark
      if (!target.closest('.filter-dropdown-container') && 
          !target.closest('input[type="checkbox"]') &&
          !target.closest('.lucide-check')) {
        setOpenDropdowns({
          sbu: false,
          company: false,
          zone: false,
          state: false,
          district: false,
          location_name: false
        });
      }
    };

    const hasOpenDropdown = Object.values(openDropdowns).some(open => open);
    if (hasOpenDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [openDropdowns]);

  const toggleDropdown = (filterType: FilterType, e?: React.MouseEvent) => {
    // Don't close if clicking inside dropdown for any filter
    if (e) {
      const target = e.target as HTMLElement;
      // If clicking inside the dropdown menu, don't toggle
      if (target.closest('.dropdown-menu-container')) {
        return;
      }
    }
    
    setOpenDropdowns(prev => {
      // Close all other dropdowns and toggle the current one
      const newState: Record<FilterType, boolean> = {
        sbu: false,
        company: false,
        zone: false,
        state: false,
        district: false,
        location_name: false
      };
      newState[filterType] = !prev[filterType];
      return newState;
    });
    // Clear search when closing
    if (openDropdowns[filterType]) {
      setSearchQueries(prev => ({ ...prev, [filterType]: '' }));
    }
  };

  const handleFilterToggle = (filterType: FilterType, value: string, e?: React.MouseEvent) => {
    // Prevent dropdown from closing for all filters
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    setSelectedFilters(prev => {
      // Company is multi-select, others are single-select
      if (filterType === 'company') {
        const current = (prev[filterType] as string[]) || [];
        const newSelection = current.includes(value)
          ? current.filter(v => v !== value)
          : [...current, value];
        
        // Clear dependent filters when company changes
        const updated = { 
          ...prev, 
          [filterType]: newSelection,
          zone: '',
          state: '',
          district: '',
          location_name: ''
        };
        
        if (onFilterChange) {
          onFilterChange(updated);
        }
        
        // Explicitly keep dropdown open for multi-select
    setOpenDropdowns(prev => ({
      ...prev,
          company: true
        }));
        
        return updated;
      } else {
        // Single select - set the value and clear dependent filters
        const updated: Record<FilterType, string[] | string> = { ...prev };
        
        if (filterType === 'sbu') {
          // Clear all dependent filters when SBU changes
          updated.sbu = value;
          updated.company = [];
          updated.zone = '';
          updated.state = '';
          updated.district = '';
          updated.location_name = '';
        } else if (filterType === 'zone') {
          // Clear state, district, location_name when zone changes
          updated.zone = value;
          updated.state = '';
          updated.district = '';
          updated.location_name = '';
        } else if (filterType === 'state') {
          // Clear district, location_name when state changes
          updated.state = value;
          updated.district = '';
          updated.location_name = '';
        } else if (filterType === 'district') {
          // Clear location_name when district changes
          updated.district = value;
          updated.location_name = '';
        } else {
          // location_name - no dependent filters
          updated[filterType] = value;
        }
        
        // Keep dropdown open after selection to show all options
        setOpenDropdowns(prev => ({
          ...prev,
          [filterType]: true
        }));
        
        if (onFilterChange) {
          onFilterChange(updated);
        }
        
        return updated;
      }
    });
  };

  const handleRemoveFilter = (filterType: FilterType, value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (filterType === 'company') {
      setSelectedFilters(prev => {
        const current = (prev[filterType] as string[]) || [];
        const newSelection = current.filter(v => v !== value);
        // Clear dependent filters when company is removed
        const updated = { 
          ...prev, 
          [filterType]: newSelection,
          zone: '',
          state: '',
          district: '',
          location_name: ''
        };
        
    if (onFilterChange) {
          onFilterChange(updated);
        }
        
        return updated;
      });
    }
  };

  const handleClear = () => {
    const cleared = {
      sbu: '',
      company: [],
      zone: '',
      state: '',
      district: '',
      location_name: ''
    };
    setSelectedFilters(cleared);
    // Reset to cached options when clearing
    setFilterOptions(cachedOptions);
    if (onFilterChange) {
      onFilterChange(cleared);
    }
  };

  const handleApply = () => {
    if (onFilterChange) {
      onFilterChange(selectedFilters);
    }
  };

  // Render multi-select component (for Company only)
  const renderMultiSelect = (filterType: FilterType, label: string, icon?: React.ReactNode) => {
    const filterValue = selectedFilters[filterType];
    const selected: string[] = Array.isArray(filterValue) ? filterValue : [];
    // Check if any parent filters are selected
    const hasParentFilters = selectedFilters.sbu;
    // Use filterOptions (from API) if parent filters are selected and we have loaded filters
    // Otherwise use cachedOptions (full list for initial state)
    const allOptions = (hasLoadedFilters && hasParentFilters) 
      ? (filterOptions[filterType] || [])
      : cachedOptions[filterType] || [];
    
    console.log(`FilterSidebar - ${filterType} options:`, {
      hasLoadedFilters,
      hasParentFilters,
      filterOptions: filterOptions[filterType],
      cachedOptions: cachedOptions[filterType],
      allOptions
    });
    
    const searchQuery = searchQueries[filterType] || '';
    const isOpen = openDropdowns[filterType];

    // Filter options based on search
    const filteredOptions = allOptions.filter(option =>
      option.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="filter-dropdown-container flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-2 w-28 flex-shrink-0">
          {icon}
          {label}
        </label>
        <div className="relative flex-1">
          <div
            className="w-full border border-gray-300 bg-white rounded-lg px-3 py-2 text-sm cursor-pointer min-h-[38px] flex items-center gap-1.5 hover:border-gray-400"
            onClick={(e) => {
              // Don't toggle if clicking on a remove button (X) inside selected badges
              if ((e.target as HTMLElement).closest('button')) {
                return;
              }
              // Don't toggle if clicking inside the dropdown menu
              if ((e.target as HTMLElement).closest('.dropdown-menu-container')) {
                return;
              }
              toggleDropdown(filterType, e);
            }}
          >
            <div className="flex-1 flex flex-wrap gap-1">
              {selected.length === 0 ? (
                <span className="text-gray-500">Select {label}</span>
              ) : (
                selected.map(value => (
                  <span
                    key={value}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
                  >
                    {value}
                    <button
                      onClick={(e) => handleRemoveFilter(filterType, value, e)}
                      className="hover:bg-blue-200 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
          </div>
          {isOpen && (
            <div 
              className="dropdown-menu-container absolute top-full left-0 right-0 z-50 bg-white border border-gray-300 rounded-lg mt-1 shadow-lg max-h-48 overflow-hidden flex flex-col"
              onClick={(e) => {
                // For multi-select (company), prevent clicks inside from closing dropdown
                if (filterType === 'company') {
                  e.stopPropagation();
                  e.preventDefault();
                }
              }}
              onMouseDown={(e) => {
                // Prevent dropdown from closing when clicking inside for multi-select
                if (filterType === 'company') {
                  e.stopPropagation();
                  e.preventDefault();
                }
              }}
            >
              {/* Search Input */}
              <div className="p-1.5 border-b border-gray-200">
                <div className="relative">
                  <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                  <input
                    type="text"
                    placeholder={`Search ${label}...`}
                    value={searchQuery}
                    onChange={(e) => {
                      e.stopPropagation();
                      setSearchQueries(prev => ({ ...prev, [filterType]: e.target.value }));
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => {
                      if (filterType === 'company') {
                        e.stopPropagation();
                      }
                    }}
                    className="w-full pl-7 pr-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              {/* Options List */}
              <div className="overflow-y-auto max-h-36">
                {isLoading ? (
                  <div className="px-2 py-2 text-xs text-gray-500 text-center">Loading...</div>
                ) : filteredOptions.length === 0 ? (
                  <div className="px-2 py-2 text-xs text-gray-500 text-center">No options found</div>
                ) : (
                  filteredOptions.map(option => (
                    <div
                      key={option}
                      className={`px-2 py-1.5 text-xs cursor-pointer hover:bg-gray-50 flex items-center gap-1.5 ${
                        selected.includes(option) ? 'bg-gray-50' : 'text-gray-800'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFilterToggle(filterType, option, e);
                      }}
                      onMouseDown={(e) => {
                        // Prevent dropdown from closing on click for multi-select
                        if (filterType === 'company') {
                          e.stopPropagation();
                        }
                      }}
                    >
                      <div className="w-4 h-4 flex items-center justify-center">
                        {selected.includes(option) && <Check className="w-4 h-4 text-gray-800" />}
                      </div>
                      <span className={selected.includes(option) ? 'font-medium' : ''}>{option}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render single-select component
  const renderSingleSelect = (filterType: FilterType, label: string, icon?: React.ReactNode) => {
    const selected = (selectedFilters[filterType] as string) || '';
    // Check if any parent filters are selected to determine if we should use filtered options
    const hasParentFilters = 
      (filterType === 'zone' && (selectedFilters.sbu || (Array.isArray(selectedFilters.company) && selectedFilters.company.length > 0))) ||
      (filterType === 'state' && (selectedFilters.sbu || (Array.isArray(selectedFilters.company) && selectedFilters.company.length > 0) || selectedFilters.zone)) ||
      (filterType === 'district' && (selectedFilters.sbu || (Array.isArray(selectedFilters.company) && selectedFilters.company.length > 0) || selectedFilters.zone || selectedFilters.state)) ||
      (filterType === 'location_name' && (selectedFilters.sbu || (Array.isArray(selectedFilters.company) && selectedFilters.company.length > 0) || selectedFilters.zone || selectedFilters.state || selectedFilters.district));
    // Use filterOptions (from API) if parent filters are selected and we have loaded filters
    // Otherwise use cachedOptions (full list for initial state)
    const allOptions = (hasLoadedFilters && hasParentFilters) 
      ? (filterOptions[filterType] || [])
      : cachedOptions[filterType] || [];
    
    // console.log(`FilterSidebar - ${filterType} options:`, {
    //   hasLoadedFilters,
    //   hasParentFilters,
    //   filterOptions: filterOptions[filterType],
    //   cachedOptions: cachedOptions[filterType],
    //   allOptions,
    //   selectedFilters
    // });
    
    const searchQuery = searchQueries[filterType] || '';
    const isOpen = openDropdowns[filterType];

    // Filter options based on search
    const filteredOptions = allOptions.filter(option =>
      option.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Get "All" label
    const allLabel = filterType === 'sbu' ? 'All SBU' : 
                     filterType === 'zone' ? 'All Zones' : 
                     filterType === 'state' ? 'All States' : 
                     filterType === 'district' ? 'All Districts' : 
                     'All Locations';

    return (
      <div className="filter-dropdown-container flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-2 w-28 flex-shrink-0">
          {icon}
          {label}
        </label>
        <div className="relative flex-1">
          <div
            className="w-full border border-gray-300 bg-white rounded-lg px-3 py-2 text-sm cursor-pointer flex items-center justify-between hover:border-gray-400 min-h-[38px]"
            onClick={(e) => {
              // Don't toggle if clicking inside the dropdown menu
              if ((e.target as HTMLElement).closest('.dropdown-menu-container')) {
                return;
              }
              toggleDropdown(filterType, e);
            }}
          >
            <span className={selected ? 'text-gray-800' : 'text-gray-500'}>
              {selected || `Select ${label}`}
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
          </div>
          {isOpen && (
            <div 
              className="dropdown-menu-container absolute top-full left-0 right-0 z-50 bg-white border border-gray-300 rounded-lg mt-1 shadow-lg max-h-48 overflow-hidden flex flex-col"
              onClick={(e) => {
                // Prevent clicks inside from closing dropdown
                e.stopPropagation();
              }}
              onMouseDown={(e) => {
                // Prevent dropdown from closing when clicking inside
                e.stopPropagation();
              }}
            >
              {/* Search Input */}
              <div className="p-1.5 border-b border-gray-200">
                <div className="relative">
                  <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                  <input
                    type="text"
                    placeholder={`Search ${label}...`}
                    value={searchQuery}
                    onChange={(e) => {
                      e.stopPropagation();
                      setSearchQueries(prev => ({ ...prev, [filterType]: e.target.value }));
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="w-full pl-7 pr-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              {/* Options List */}
              <div className="overflow-y-auto max-h-36">
                {isLoading ? (
                  <div className="px-2 py-2 text-xs text-gray-500 text-center">Loading...</div>
                ) : (
                  <>
                    {/* All Option - Selectable */}
                    <div
                      className={`px-2 py-1.5 text-xs cursor-pointer hover:bg-gray-50 flex items-center gap-1.5 ${
                        !selected ? 'bg-gray-50' : 'text-gray-800'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFilterToggle(filterType, '', e);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <div className="w-4 h-4 flex items-center justify-center">
                        {!selected && <Check className="w-4 h-4 text-gray-800" />}
                      </div>
                      <span className={!selected ? 'font-medium' : ''}>{allLabel}</span>
                    </div>
                    
                    {/* Filtered Options */}
                    {filteredOptions.length === 0 ? (
                      <div className="px-2 py-2 text-xs text-gray-500 text-center">No options found</div>
                    ) : (
                      filteredOptions.map(option => (
                        <div
                          key={option}
                          className={`px-2 py-1.5 text-xs cursor-pointer hover:bg-gray-50 flex items-center gap-1.5 ${
                            selected === option ? 'bg-gray-50' : 'text-gray-800'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFilterToggle(filterType, option, e);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <div className="w-4 h-4 flex items-center justify-center">
                            {selected === option && <Check className="w-4 h-4 text-gray-800" />}
                          </div>
                          <span className={selected === option ? 'font-medium' : ''}>{option}</span>
                        </div>
                      ))
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-200 h-full shadow-sm rounded-lg mr-0 m-1 -mt-1 w-96 overflow-hidden">
      {/* Content */}
      <div className="p-2 space-y-6 overflow-hidden h-full flex flex-col">
        {/* Header */}
        {/* <div className="pb-3 border-b border-gray-300">
          <h3 className="text-sm font-semibold text-gray-800">FILTERS</h3>
        </div> */}

        {/* SBU Single-Select with Upload button */}
        {renderSingleSelect(
          'sbu',
          'SBU',
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowUploadDialog(true);
            }}
            title={canUpload() ? 'Upload SBU file' : 'Select SBU first to upload'}
            className={`p-0.5 rounded transition-colors ${canUpload() ? 'text-green-600 hover:bg-green-50 cursor-pointer' : 'text-gray-400 cursor-pointer'}`}
          >
            <Upload className="w-4 h-4" />
          </button>
        )}

        {/* Company Multi-Select */}
        {renderMultiSelect('company', 'Company', <Building2 className="w-4 h-4 text-gray-600" />)}

        {/* Zone Single-Select */}
        {renderSingleSelect('zone', 'Zone', <Globe className="w-4 h-4 text-gray-600" />)}

        {/* State Single-Select */}
        {renderSingleSelect('state', 'State', <Map className="w-4 h-4 text-gray-600" />)}

        {/* District Single-Select */}
        {renderSingleSelect('district', 'District', <MapPin className="w-4 h-4 text-gray-600" />)}

        {/* Location Single-Select */}
        {renderSingleSelect('location_name', 'Location', <SearchIcon className="w-4 h-4 text-gray-600" />)}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-5 border-t border-gray-200 mt-auto">
          <button
            onClick={handleClear}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Clear All
          </button>
          <button
            onClick={handleApply}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </div>

      <UploadDialog
        showUploadDialog={showUploadDialog}
        setShowUploadDialog={setShowUploadDialog}
        uploadStatus={uploadStatus}
        resetUploadStatus={resetUploadStatus}
        canUpload={canUpload}
        handleFileSelect={handleFileSelect}
        fileInputRef={fileInputRef}
        selectedSbu={typeof selectedFilters.sbu === 'string' ? selectedFilters.sbu : ''}
      />
    </div>
  );
};

export default FilterSidebar;
