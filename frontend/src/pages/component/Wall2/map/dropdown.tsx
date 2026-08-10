import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Upload, ChevronDown, Search, X, Users, Building2, MapIcon, Navigation, Landmark, MapPin } from 'lucide-react';

// Mock data
const MOCK_SBU = ['SOD', 'LPG', 'Lubes', 'Aviation'];
const MOCK_COMPANIES = [
  'HPCL Mumbai',
  'HPCL Delhi',
  'HPCL Bangalore',
  'HPCL Chennai',
  'HPCL Kolkata',
  'HPCL Hyderabad',
  'HPCL Pune',
  'HPCL Ahmedabad'
];
const MOCK_ZONES = ['North Zone', 'South Zone', 'East Zone', 'West Zone', 'Central Zone'];
const MOCK_STATES = ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'West Bengal', 'Gujarat', 'Rajasthan', 'Punjab'];
const MOCK_DISTRICTS = ['Mumbai', 'Thane', 'Pune', 'Nashik', 'Nagpur', 'Aurangabad'];
const MOCK_LOCATIONS = [
  'IRUMPANAM TERMINAL',
  'MUMBAI TERMINAL',
  'DELHI TERMINAL',
  'BANGALORE TERMINAL',
  'CHENNAI TERMINAL',
  'KOLKATA TERMINAL'
];

const FILTER_ICONS: Record<string, React.ReactNode> = {
  sbu: <Users className="w-4 h-4" />,
  company: <Building2 className="w-4 h-4" />,
  zone: <MapIcon className="w-4 h-4" />,
  state: <Navigation className="w-4 h-4" />,
  district: <Landmark className="w-4 h-4" />,
  location_name: <MapPin className="w-4 h-4" />
};

interface DropdownProps {
  isOpen?: boolean;
  onClose?: () => void;
  shouldShowUpload?: boolean;
}

const Dropdown: React.FC<DropdownProps> = ({ isOpen = true, onClose, shouldShowUpload = true }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string | string[]>>({
    sbu: '',
    company: [],
    zone: '',
    state: '',
    district: '',
    location_name: ''
  });

  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const toggleDropdown = (key: string, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    setOpenDropdowns(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const closeAllDropdowns = () => {
    setOpenDropdowns({});
    setSearchTerms({});
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (Object.values(dropdownRefs.current).some(ref => ref?.contains(event.target as Node))) return;
      closeAllDropdowns();
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSbuChange = (value: string) => {
    setSelectedFilters({
      sbu: value,
      company: [],
      zone: '',
      state: '',
      district: '',
      location_name: ''
    });
    setOpenDropdowns(prev => ({ ...prev, sbu: false }));
  };

  const handleCompanyChange = (value: string) => {
    const current = selectedFilters.company as string[];
    const newCompanies = current.includes(value)
      ? current.filter(c => c !== value)
      : [...current, value];
    setSelectedFilters(prev => ({
      ...prev,
      company: newCompanies,
      zone: '',
      state: '',
      district: '',
      location_name: ''
    }));
  };

  const handleSingleSelectChange = (key: string, value: string) => {
    const currentValue = selectedFilters[key];
    const newValue = currentValue === value ? '' : value;
    setSelectedFilters(prev => ({ ...prev, [key]: newValue }));
    setOpenDropdowns(prev => ({ ...prev, [key]: false }));
  };

  const handleClear = () => {
    setSelectedFilters({
      sbu: '',
      company: [],
      zone: '',
      state: '',
      district: '',
      location_name: ''
    });
    closeAllDropdowns();
  };

  const handleApply = () => {
    console.log('Applied filters:', selectedFilters);
    closeAllDropdowns();
  };

  const getDisplayText = (key: string): string => {
    const value = selectedFilters[key];
    if (key === 'company') {
      const companies = value as string[];
      if (companies.length === 0) return 'Select Companies...';
      if (companies.length === 1) return companies[0];
      return `${companies.length} companies selected`;
    }
    return value && value !== '' ? (typeof value === 'string' ? value : '') : 'All';
  };

  const getFilteredOptions = (key: string): string[] => {
    let options: string[] = [];
    switch (key) {
      case 'sbu': options = MOCK_SBU; break;
      case 'company': options = MOCK_COMPANIES; break;
      case 'zone': options = MOCK_ZONES; break;
      case 'state': options = MOCK_STATES; break;
      case 'district': options = MOCK_DISTRICTS; break;
      case 'location_name': options = MOCK_LOCATIONS; break;
    }
    const searchTerm = searchTerms[key]?.toLowerCase() || '';
    return searchTerm ? options.filter(opt => opt.toLowerCase().includes(searchTerm)) : options;
  };

  const renderDropdown = (key: string, label: string, isMultiSelect: boolean = false) => {
    const isOpen = openDropdowns[key];
    const filteredOptions = getFilteredOptions(key);
    const searchTerm = searchTerms[key] || '';
    const selectedValue = selectedFilters[key];

    return (
      <div key={key} className="mb-4">
        <label className="block mb-2 text-sm font-medium text-gray-700 capitalize">
          {label}
        </label>
        <div className="relative" ref={el => { dropdownRefs.current[key] = el; }}>
          <div
            className="w-full border border-gray-300 bg-white text-gray-800 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-400 cursor-pointer flex justify-between items-center shadow-sm"
            onClick={(e) => toggleDropdown(key, e)}
          >
            <span className="truncate flex items-center gap-2">
              {FILTER_ICONS[key]}
              {getDisplayText(key)}
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </div>

          {isOpen && (
            <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-300 rounded-lg mt-1 shadow-xl max-h-64 overflow-hidden">
              {/* Search Input */}
              <div className="p-2 border-b border-gray-200">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder={`Search ${label.toLowerCase()}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerms(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full pl-8 pr-8 py-2 bg-gray-50 border border-gray-300 rounded text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    onClick={(e) => e.stopPropagation()}
                  />
                  {searchTerm && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSearchTerms(prev => ({ ...prev, [key]: '' }));
                      }}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Options */}
              <div className="max-h-48 overflow-y-auto">
                {/* All Option */}
                {!isMultiSelect && (
                  <div
                    className={`px-3 py-2.5 text-sm hover:bg-blue-50 cursor-pointer transition-colors duration-150 flex items-center gap-3 ${
                      !selectedValue || selectedValue === '' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-800'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSingleSelectChange(key, '');
                    }}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                      !selectedValue || selectedValue === '' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                    }`}>
                      {(!selectedValue || selectedValue === '') && (
                        <div className="w-2 h-2 rounded-full bg-white"></div>
                      )}
                    </div>
                    <span>All</span>
                  </div>
                )}

                {filteredOptions.length > 0 ? (
                  filteredOptions.map(option => {
                    const isSelected = isMultiSelect
                      ? (selectedValue as string[]).includes(option)
                      : selectedValue === option;

                    return (
                      <div
                        key={option}
                        className={`px-3 py-2.5 text-sm hover:bg-blue-50 cursor-pointer transition-colors duration-150 flex items-center gap-3 ${
                          isSelected ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-800'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isMultiSelect) {
                            handleCompanyChange(option);
                          } else {
                            handleSingleSelectChange(key, option);
                          }
                        }}
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                          isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                        }`}>
                          {isSelected && (
                            <div className="w-2 h-2 rounded-full bg-white"></div>
                          )}
                        </div>
                        <span>{option}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-3 py-4 text-sm text-gray-400 text-center">
                    {searchTerm ? `No results found for "${searchTerm}"` : 'No options available'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  const getSelectedValues = (key: string): string[] => {
    const value = selectedFilters[key];
    return Array.isArray(value) ? value : (value ? [value] : []);
  };

  const renderCollapsed = () => (
    <div className="w-16 bg-white border-r border-gray-200 shadow-lg h-full overflow-auto relative">
      <div
        className="absolute -right-3 top-2 z-20 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-r-lg shadow-lg cursor-pointer transition-all duration-300 transform hover:scale-105"
        onClick={() => setIsCollapsed(false)}
        title="Expand Filters"
      >
        <ChevronRight className="w-4 h-4" />
      </div>
      <div className="mt-8 space-y-4 p-2">
        {shouldShowUpload && (
          <div
            className="flex items-center justify-center p-3 rounded-lg bg-green-600 hover:bg-green-700 text-white cursor-pointer transition-all duration-200 shadow-md"
            onClick={() => {/* Handle upload */}}
            title="Upload File"
          >
            <Upload className="w-4 h-4" />
          </div>
        )}
        {['sbu', 'company', 'zone', 'state', 'district', 'location_name'].map((key) => {
          const isActive = getSelectedValues(key).length > 0;
          return (
            <div
              key={key}
              className={`flex items-center justify-center p-3 rounded-lg transition-all duration-200 cursor-pointer relative ${
                isActive
                  ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-2 border-transparent'
              }`}
              onClick={() => setIsCollapsed(false)}
              title={`${key.replace(/_/g, ' ')} ${isActive ? '(Active)' : ''}`}
            >
              {FILTER_ICONS[key]}
              {isActive && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  if (isCollapsed) {
    return renderCollapsed();
  }

  return (
    <div className="w-80 bg-white border-r border-gray-200 shadow-lg h-full overflow-auto transition-all duration-300">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-800">Filters</h3>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 shadow-md"
          title="Collapse Filters"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* SBU with Upload Button */}
        <div className="mb-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <label className="block text-sm font-medium text-gray-700">SBU</label>
            <button
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-md"
              title="Upload File"
            >
              <Upload className="w-3 h-3" />
              Upload
            </button>
          </div>
          <div className="relative" ref={el => { dropdownRefs.current['sbu'] = el; }}>
            <div
              className="w-full border border-gray-300 bg-white text-gray-800 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-400 cursor-pointer flex justify-between items-center shadow-sm"
              onClick={(e) => toggleDropdown('sbu', e)}
            >
              <span className="truncate flex items-center gap-2">
                {FILTER_ICONS.sbu}
                {selectedFilters.sbu || 'SBU'}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${openDropdowns['sbu'] ? 'rotate-180' : ''}`} />
            </div>
            {openDropdowns['sbu'] && (
              <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-300 rounded-lg mt-1 shadow-xl max-h-64 overflow-hidden">
                <div className="max-h-48 overflow-y-auto">
                  <div
                    className={`px-3 py-2.5 text-sm hover:bg-blue-50 cursor-pointer transition-colors duration-150 ${
                      !selectedFilters.sbu || selectedFilters.sbu === '' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-800'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSbuChange('');
                    }}
                  >
                    SBU
                  </div>
                  {MOCK_SBU.map(sbu => (
                    <div
                      key={sbu}
                      className={`px-3 py-2.5 text-sm hover:bg-blue-50 cursor-pointer transition-colors duration-150 ${
                        selectedFilters.sbu === sbu ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-800'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSbuChange(sbu);
                      }}
                    >
                      {sbu}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Other Filters */}
        {renderDropdown('company', 'Company', true)}
        {renderDropdown('zone', 'Zone')}
        {renderDropdown('state', 'State')}
        {renderDropdown('district', 'District')}
        {renderDropdown('location_name', 'Location Name')}

        {/* Action Buttons */}
        <div className="flex gap-2 mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={handleClear}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-md"
          >
            Clear
          </button>
          <button
            onClick={handleApply}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-md"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dropdown;
