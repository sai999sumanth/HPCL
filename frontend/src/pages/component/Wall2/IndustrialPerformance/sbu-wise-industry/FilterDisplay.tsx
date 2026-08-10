import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Filter, ChevronDown, X, Check, Lock, Search } from 'lucide-react';
import { FilterValues } from './types';
import { apiClient } from "@/services/apiClient";

interface FilterDisplayProps {
  title: string;
  filters: FilterValues;
  onFiltersChange: (filters: FilterValues) => void;
  /** Route SBU (e.g. Retail, LPG) — shown in the locked SBU control; `filters.sbu_name` stays API form (e.g. RETAIL). */
  pageSbu?: string;
}

interface DropdownOption { 
  value: string;
  label: string;
}

const allFiscalMonths: DropdownOption[] = [ 
  { value: 'APR', label: 'APR' }, { value: 'MAY', label: 'MAY' }, { value: 'JUN', label: 'JUN' },
  { value: 'JUL', label: 'JUL' }, { value: 'AUG', label: 'AUG' }, { value: 'SEP', label: 'SEP' },
  { value: 'OCT', label: 'OCT' }, { value: 'NOV', label: 'NOV' }, { value: 'DEC', label: 'DEC' },
  { value: 'JAN', label: 'JAN' }, { value: 'FEB', label: 'FEB' }, { value: 'MAR', label: 'MAR' }
];

const formatFiscalYear = (startYear: number) => `${startYear}-${startYear + 1}`;

const getCurrentFiscalYear = (date = new Date()) => {
  const year = date.getFullYear();
  return date.getMonth() >= 3 ? formatFiscalYear(year) : formatFiscalYear(year - 1);
};

const getPreviousFiscalYear = (fiscalYear: string) => {
  const [startYear] = fiscalYear.split('-').map(Number);
  return formatFiscalYear(startYear - 1);
};

const getFiscalYearOptions = () => {
  const currentFiscalYear = getCurrentFiscalYear();
  const previousFiscalYear = getPreviousFiscalYear(currentFiscalYear);
  return [
    { value: currentFiscalYear, label: currentFiscalYear },
    { value: previousFiscalYear, label: previousFiscalYear }
  ];
};

const companyList: string[] = [
  "HPCL", "BPCL", "IOCL", "ONGC", "OIL", "GAIL", "RIL"
];

// Helper function to fetch distinct values for filters
const fetchDistinctValues = async (column: string, conditions: { key: string; cond: string; value: string }[] = []) => {
  try {
    const requestBody = {
      connection_id: "1",
      schema: "public",
      table: "industry_performance",
      column: [column],
      where_cond: conditions,
    };
    const response = await apiClient.post("/api/charts/get_distinct_values", requestBody);
    return response.data.data[column] || [];
  } catch (error) {
    console.error(`Error fetching ${column}:`, error);
    return [];
  }
};

// Helper to get valid months for the selected fiscal year.
const getMonthOptionsForYear = (year: string): DropdownOption[] => { 
  const currentFiscalYear = getCurrentFiscalYear();

  if (year === currentFiscalYear) {
    const now = new Date();
    const previousMonthDate = new Date(now.getFullYear(), now.getMonth(), 0);
    const currentFiscalStartYear = Number(currentFiscalYear.split('-')[0]);
    const cutoffIndex =
      previousMonthDate.getFullYear() === currentFiscalStartYear
        ? previousMonthDate.getMonth() - 3
        : previousMonthDate.getMonth() + 9;

    return cutoffIndex >= 0 ? allFiscalMonths.slice(0, cutoffIndex + 1) : [allFiscalMonths[0]];
  }

  return allFiscalMonths;
};

// Helper to get the previous month's abbreviation
const getPreviousFiscalMonthAbbr = (): string => {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const now = new Date();
  const previousMonthDate = new Date(now.getFullYear(), now.getMonth(), 0);
  return months[previousMonthDate.getMonth()];
};

const FilterDisplay: React.FC<FilterDisplayProps> = ({ title, filters, onFiltersChange, pageSbu }) => { 
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Dynamic dropdown options state
  const [dynamicOptions, setDynamicOptions] = useState({
    zones: [] as string[],
    regions: [] as string[],
    states: [] as string[],
    districts: [] as string[],
    products: [] as string[]
  });

  const [isLoadingOptions, setIsLoadingOptions] = useState({
    zones: false,
    regions: false,
    states: false,
    districts: false,
    products: false
  });

  const monthOptions = useMemo(() => getMonthOptionsForYear(filters.fiscal_year), [filters.fiscal_year]);
  const fiscalYearOptions = useMemo(() => getFiscalYearOptions(), []);

  useEffect(() => {
    if (monthOptions.length === 0) return;
    if (!monthOptions.some((option) => option.value === filters.month_name)) {
      const fallbackMonth =
        filters.fiscal_year === getCurrentFiscalYear()
          ? getPreviousFiscalMonthAbbr()
          : monthOptions[0].value;
      onFiltersChange({ ...filters, month_name: fallbackMonth });
    }
  }, [filters, monthOptions, onFiltersChange]);

  // Base conditions for API calls (SBU and Company)
  const getBaseConditions = () => {
    const conditions = [];
    if (filters.sbu_name) {
      conditions.push({ key: "sbu_name", cond: "=", value: filters.sbu_name });
    }
    if (filters.coname && filters.coname !== 'HPCL') {
      conditions.push({ key: "coname", cond: "=", value: filters.coname });
    }
    return conditions;
  };

  // 1. Fetch zones initially (independent of other geographic filters)
  useEffect(() => {
    const loadZones = async () => {
      setIsLoadingOptions(prev => ({ ...prev, zones: true }));
      const baseConditions = getBaseConditions();
      const zones = await fetchDistinctValues("zone_name", baseConditions);
      setDynamicOptions(prev => ({ ...prev, zones }));
      setIsLoadingOptions(prev => ({ ...prev, zones: false }));
    };
    
    loadZones();
  }, [filters.sbu_name, filters.coname]);

  // 2. Fetch regions based on selected zone
  useEffect(() => {
    const loadRegions = async () => {
      setIsLoadingOptions(prev => ({ ...prev, regions: true }));
      const conditions = getBaseConditions();
      
      if (filters.zone_name) {
        conditions.push({ key: "zone_name", cond: "=", value: filters.zone_name });
      }
      
      const regions = await fetchDistinctValues("ro", conditions);
      setDynamicOptions(prev => ({ ...prev, regions }));
      setIsLoadingOptions(prev => ({ ...prev, regions: false }));
    };

    loadRegions();
  }, [filters.zone_name, filters.sbu_name, filters.coname]);

  // 3. Fetch states based on selected zone and region
  useEffect(() => {
    const loadStates = async () => {
      setIsLoadingOptions(prev => ({ ...prev, states: true }));
      const conditions = getBaseConditions();
      
      if (filters.zone_name) {
        conditions.push({ key: "zone_name", cond: "=", value: filters.zone_name });
      }
      // Use region_name when sending conditions to API
      if (filters.region_name) {
        conditions.push({ key: "ro", cond: "=", value: filters.region_name });
      }
      
      const states = await fetchDistinctValues("statename", conditions);
      setDynamicOptions(prev => ({ ...prev, states }));
      setIsLoadingOptions(prev => ({ ...prev, states: false }));
    };

    loadStates();
  }, [filters.zone_name, filters.region_name, filters.sbu_name, filters.coname]);

  // 4. Fetch districts based on selected zone, region, and state
  useEffect(() => {
    const loadDistricts = async () => {
      setIsLoadingOptions(prev => ({ ...prev, districts: true }));
      const conditions = getBaseConditions();
      
      if (filters.zone_name) {
        conditions.push({ key: "zone_name", cond: "=", value: filters.zone_name });
      }
      // Use region_name when sending conditions to API
      if (filters.region_name) {
        conditions.push({ key: "ro", cond: "=", value: filters.region_name });
      }
      if (filters.statename) {
        conditions.push({ key: "statename", cond: "=", value: filters.statename });
      }
      
      const districts = await fetchDistinctValues("distname", conditions);
      setDynamicOptions(prev => ({ ...prev, districts }));
      setIsLoadingOptions(prev => ({ ...prev, districts: false }));
    };

    loadDistricts();
  }, [filters.zone_name, filters.region_name, filters.statename, filters.sbu_name, filters.coname]);

  // 5. Fetch products with additional filters
  useEffect(() => {
    const loadProducts = async () => {
      setIsLoadingOptions(prev => ({ ...prev, products: true }));
      const baseConditions = getBaseConditions();
      
      // Add additional filters for product fetching
      baseConditions.push(
        { key: "zone_name", cond: "!=", value: "" },
        { key: "zone_name", cond: "!=", value: "-" },
        { key: "sbu_name", cond: "!=", value: "0" }
      );
      
      const products = await fetchDistinctValues("productname", baseConditions);
      setDynamicOptions(prev => ({ ...prev, products }));
      setIsLoadingOptions(prev => ({ ...prev, products: false }));
    };

    loadProducts();
  }, [filters.sbu_name, filters.coname]);

  // Reset dependent filters when parent filter changes
  useEffect(() => {
    // When zone changes, reset region, state, district
    const newFilters = { ...filters };
    let hasChanges = false;

    if (filters.region_name && !dynamicOptions.regions.includes(filters.region_name)) {
      newFilters.region_name = '';
      newFilters.statename = '';
      newFilters.distname = '';
      hasChanges = true;
    }

    if (hasChanges) {
      onFiltersChange(newFilters);
    }
  }, [dynamicOptions.regions]);

  useEffect(() => {
    // When region changes, reset state, district
    const newFilters = { ...filters };
    let hasChanges = false;

    if (filters.statename && !dynamicOptions.states.includes(filters.statename)) {
      newFilters.statename = '';
      newFilters.distname = '';
      hasChanges = true;
    }

    if (hasChanges) {
      onFiltersChange(newFilters);
    }
  }, [dynamicOptions.states]);

  useEffect(() => {
    // When state changes, reset district
    const newFilters = { ...filters };
    let hasChanges = false;

    if (filters.distname && !dynamicOptions.districts.includes(filters.distname)) {
      newFilters.distname = '';
      hasChanges = true;
    }

    if (hasChanges) {
      onFiltersChange(newFilters);
    }
  }, [dynamicOptions.districts]);

  const filterOptions = { 
    zone_name: [
      { value: '', label: 'All Zones' },
      ...dynamicOptions.zones.sort().map(zone => ({ value: zone, label: zone }))
    ],
    region_name: [
      { value: '', label: 'All Regions' },
      ...dynamicOptions.regions.sort().map(region => ({ value: region, label: region }))
    ],
    statename: [
      { value: '', label: 'All States' },
      ...dynamicOptions.states.sort().map(state => ({ value: state, label: state }))
    ],
    distname: [
      { value: '', label: 'All Districts' },
      ...dynamicOptions.districts.sort().map(dist => ({ value: dist, label: dist }))
    ],
    coname: [
      { value: 'HPCL', label: 'HPCL' },
      ...companyList.filter(company => company !== 'HPCL').sort().map(company => ({ value: company, label: company }))
    ],
    fiscal_year: fiscalYearOptions,
    productname: [
      { value: '', label: 'All Products' },
      ...dynamicOptions.products.sort().map(product => ({ value: product, label: product }))
    ],
  };

  useEffect(() => {  
    if (openDropdown && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [openDropdown]);

  const handleFilterChange = (key: keyof FilterValues, value: string) => { 
    let newFilters = { ...filters, [key]: value };
    
    // Handle cascade resets when parent filters change
    if (key === 'zone_name') {
      newFilters.region_name = '';
      newFilters.statename = '';
      newFilters.distname = '';
    } else if (key === 'region_name') {
      newFilters.statename = '';
      newFilters.distname = '';
    } else if (key === 'statename') {
      newFilters.distname = '';
    }
    
    if (key === 'fiscal_year') {
      if (value === getCurrentFiscalYear()) {
        newFilters.month_name = getPreviousFiscalMonthAbbr();
      } else {
        newFilters.month_name = 'APR';
      }
    }
    
    onFiltersChange(newFilters);
    setOpenDropdown(null);
  };

  const handleProductChange = (productValue: string) => {
    const currentProducts = filters.productname;
    
    // Handle "All Products" selection (empty string)
if (productValue === '') {
  const newFilters = { ...filters, productname: [] };
  onFiltersChange(newFilters);
  return;
}
 
    // Handle "Select All" functionality (for actual product values)
    if (productValue === 'SELECT_ALL') {
      const allProductValues = filterOptions.productname
        .filter(p => p.value !== '') // Exclude the "All Products" option
        .map(p => p.value);
      const newFilters = { ...filters, productname: allProductValues };
      onFiltersChange(newFilters);
      return;
    }

    const newProducts = currentProducts.includes(productValue)
      ? currentProducts.filter(p => p !== productValue)
      : [...currentProducts, productValue];
    
    const newFilters = { ...filters, productname: newProducts };
    onFiltersChange(newFilters);
  };

  const toggleDropdown = (key: string) => {
    setOpenDropdown(openDropdown === key ? null : key);
    setSearchTerm('');
  };

  const getDisplayValue = (key: keyof FilterValues): string => { 
    if (key === 'productname') { 
      const products = filters.productname;
      if (products.length === 0) return 'All Products';
      if (products.length === 1) return products[0];
      if (products.length === filterOptions.productname.length - 1) return 'All Products'; // -1 for "All Products" option
      return `${products.length} Selected`;
    }
    
    // Get the actual value from filters
    const value = filters[key] as string;
    const options = key === 'month_name' ? monthOptions : filterOptions[key as keyof typeof filterOptions];
    const option = options?.find(opt => opt.value === value);
    return option ? option.label : value || 'All';
  };

  const removeProduct = (productToRemove: string) => { 
    const newProducts = filters.productname.filter(p => p !== productToRemove);
    const newFilters = { ...filters, productname: newProducts };
    onFiltersChange(newFilters);
  };

  const clearAllProducts = () => { 
    const newFilters = { ...filters, productname: [] };
    onFiltersChange(newFilters);
  };

  const selectAllProducts = () => { 
    const allProductValues = filterOptions.productname
      .filter(p => p.value !== '') // Exclude the "All Products" option
      .map(p => p.value);
    const newFilters = { ...filters, productname: allProductValues };
    onFiltersChange(newFilters);
  };

  const filterConfigs = [
    { key: 'sbu_name' as keyof FilterValues, label: 'SBU', disabled: true },
    { key: 'coname' as keyof FilterValues, label: 'Company' },
    { key: 'zone_name' as keyof FilterValues, label: 'Zone' },
    { key: 'region_name' as keyof FilterValues, label: 'Region' },
    { key: 'statename' as keyof FilterValues, label: 'State' },
    { key: 'distname' as keyof FilterValues, label: 'District' },
    { key: 'fiscal_year' as keyof FilterValues, label: 'Fiscal Year' },
    { key: 'productname' as keyof FilterValues, label: 'Product' },
    { key: 'month_name' as keyof FilterValues, label: 'Month' }
  ];

  const isDropdownLoading = (key: string): boolean => {
    switch (key) {
      case 'zone_name': return isLoadingOptions.zones;
      case 'region_name': return isLoadingOptions.regions;
      case 'statename': return isLoadingOptions.states;
      case 'distname': return isLoadingOptions.districts;
      case 'productname': return isLoadingOptions.products;
      default: return false;
    }
  };

  const renderDropdownContent = (config: typeof filterConfigs[0]) => {
    const isMultiSelect = config.key === 'productname';
    const options = config.key === 'month_name' ? monthOptions : filterOptions[config.key as keyof typeof filterOptions];
    const isLoading = isDropdownLoading(config.key);
    
    // Add safety check for options
    if (!options) {
      return (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 flex flex-col">
          <div className="px-3 py-4 text-center text-xs text-gray-500">
            No options available
          </div>
        </div>
      );
    }
    
    if (isLoading) {
      return (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 flex flex-col">
          <div className="px-3 py-4 text-center text-xs text-gray-500">
            Loading options...
          </div>
        </div>
      );
    }
    
    const filteredOptions = options.filter(opt =>
      opt.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 flex flex-col">
        {isMultiSelect && (
          <div className="sticky top-0 bg-gray-50 px-3 py-2 border-b text-xs">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button 
                  onClick={selectAllProducts} 
                  className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                >
                  Select All
                </button>
                {filters.productname.length > 0 && (
                  <button 
                    onClick={clearAllProducts} 
                    className="text-red-600 hover:text-red-700 text-xs font-medium"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="p-2 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={`Search ${config.label}...`}
              className="w-full pl-7 pr-2 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
        <div className="overflow-y-auto max-h-48">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option: DropdownOption) => { 
              const isSelected = isMultiSelect 
 ? (option.value === '' 
      ? filters.productname.length === 0  // "All Products" is selected when array is empty
      : filters.productname.includes(option.value))
  : filters[config.key] === option.value;

              return (  
                <button
                  key={option.value}
                  onClick={() => isMultiSelect ? handleProductChange(option.value) : handleFilterChange(config.key, option.value)}
                  className={`w-full px-3 py-2 text-xs text-left hover:bg-gray-50 transition-colors flex items-center justify-between ${isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                >
                  <span>{option.label}</span>
                  {isSelected && <Check className="h-3 w-3 text-blue-600" />}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-2 text-xs text-center text-gray-500">
              No results found
            </div>
          )}
        </div>
      </div>
    );
  };

  return ( 
    <div className="bg-white rounded-md shadow-sm border p-3 mb-2">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="h-4 w-4 text-blue-500" />
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-3">
        {filterConfigs.map((config) => (
          <div key={config.key}>
            <label className="text-xs text-gray-500 font-medium mb-1 block">
              {config.label}:
            </label>
            <div className="relative">
              {config.disabled ? (
                <div className="w-full bg-gray-100 text-gray-500 px-2 py-1.5 rounded text-xs font-medium text-left flex items-center justify-between border border-gray-200 cursor-not-allowed">
                  <span className="truncate">
                    {config.key === "sbu_name" && pageSbu
                      ? pageSbu
                      : (filters[config.key] as string) || "—"}
                  </span>
                  <Lock className="h-3 w-3" />
                </div>
              ) : (
                <button
                  onClick={() => toggleDropdown(config.key)}
                  className={`w-full px-2 py-1.5 rounded text-xs font-medium text-left flex items-center justify-between transition-colors border ${
                    isDropdownLoading(config.key)
                      ? 'bg-gray-50 text-gray-500 border-gray-200 cursor-wait'
                      : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                  }`}
                  disabled={isDropdownLoading(config.key)}
                >
                  <span className="truncate">
                    {isDropdownLoading(config.key) ? 'Loading...' : getDisplayValue(config.key)}
                  </span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${openDropdown === config.key ? 'rotate-180' : ''}`} />
                </button>
              )}
              
              {openDropdown === config.key && !config.disabled && renderDropdownContent(config)}
            </div>
          </div>
        ))}
      </div>

      {filters.productname.length > 0 && (   
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-500 mb-2">Selected Products:</div>
          <div className="flex flex-wrap gap-1">
            {filters.productname.map((product) => ( 
              <span key={product} className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                {product}
                <button onClick={() => removeProduct(product)} className="text-blue-500 hover:text-blue-700 ml-1">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
      
      {openDropdown && <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)} />}
    </div>
  );
};

export default FilterDisplay;