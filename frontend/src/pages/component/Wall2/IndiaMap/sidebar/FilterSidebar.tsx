import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Upload, ChevronDown, Search, X } from 'lucide-react';

interface FilterSidebarProps {
 filtersOpen: boolean;
 setFiltersOpen: (open: boolean) => void;
 filters: Record<string, string[]>;
 selectedFilters: Record<string, string | string[]>;
 setSelectedFilters: React.Dispatch<React.SetStateAction<Record<string, string | string[]>>>;
 shouldShowUpload: () => boolean;
 setShowUploadDialog: (show: boolean) => void;
 clearFilters: () => void;
 fetchFilteredData: () => void;
 getFilterIcon: (key: string) => React.ReactNode;
}

const FILTER_HIERARCHY = ['company', 'zone', 'state', 'district', 'location_name'];

const FilterSidebar: React.FC<FilterSidebarProps> = ({
 filtersOpen,
 setFiltersOpen,
 filters,
 selectedFilters,
 setSelectedFilters,
 shouldShowUpload,
 setShowUploadDialog,
 clearFilters,
 fetchFilteredData,
 getFilterIcon,
}) => {
 const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});
 const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
 const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});
 const searchInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
 const [displayOptions, setDisplayOptions] = useState<Record<string, string[]>>(filters);
 
 const lastChangedKey = useRef<string | null>(null);

 useEffect(() => {
 setDisplayOptions(prevOptions => {
 const newOptions = { ...prevOptions };
 for (const key in filters) {
 if (key !== lastChangedKey.current) {
 newOptions[key] = filters[key] || [];
 }
 }
 Object.keys(newOptions).forEach(key => {
 if (!filters[key]) {
 delete newOptions[key];
 }
 });
 return newOptions;
 });

 const timer = setTimeout(() => {
 lastChangedKey.current = null;
 }, 150);

 return () => clearTimeout(timer);
 }, [filters]);

 const getSelectedValues = useCallback((key: string): string[] => {
 const value = selectedFilters[key];
 return Array.isArray(value) ? value : (value ? [value] : []);
 }, [selectedFilters]);

 const getFilteredOptions = useCallback((key: string): string[] => {
 const options = displayOptions[key] || [];
 const searchTerm = searchTerms[key]?.toLowerCase() || '';
 
 if (!searchTerm) return options;
 
 return options.filter(option => 
 option.toLowerCase().includes(searchTerm)
 );
 }, [displayOptions, searchTerms]);

 const toggleDropdown = (key: string, event?: React.MouseEvent) => {
 if (event) event.stopPropagation();
 setOpenDropdowns(prev => {
 const newState = { ...prev, [key]: !prev[key] };
 
 // Focus search input when opening dropdown
 if (newState[key]) {
 setTimeout(() => {
 searchInputRefs.current[key]?.focus();
 }, 100);
 }
 
 return newState;
 });
 };

 const closeAllDropdowns = () => {
 setOpenDropdowns({});
 setSearchTerms({});
 };

 const handleSearchChange = (key: string, value: string) => {
 setSearchTerms(prev => ({ ...prev, [key]: value }));
 };

 const clearSearch = (key: string, event: React.MouseEvent) => {
 event.stopPropagation();
 setSearchTerms(prev => ({ ...prev, [key]: '' }));
 searchInputRefs.current[key]?.focus();
 };

 useEffect(() => {
 const handleClickOutside = (event: MouseEvent) => {
 if (Object.values(dropdownRefs.current).some(ref => ref?.contains(event.target as Node))) return;
 const companyDropdown = document.querySelector('[data-dropdown="company"]');
 if (companyDropdown?.contains(event.target as Node)) return;
 closeAllDropdowns();
 };

 if (filtersOpen) {
 document.addEventListener('mousedown', handleClickOutside);
 return () => document.removeEventListener('mousedown', handleClickOutside);
 }
 }, [filtersOpen]);

 // Enhanced Company Dropdown with better multiselect functionality
 const CompanyDropdownWithSearch = ({ values, selectedValues, onSelectionChange }: {
 values: string[];
 selectedValues: string[];
 onSelectionChange: (values: string[]) => void;
 }) => {
 const [isOpen, setIsOpen] = useState(false);
 const [searchTerm, setSearchTerm] = useState('');
 const searchRef = useRef<HTMLInputElement>(null);
 const dropdownRef = useRef<HTMLDivElement>(null);

 const filteredValues = values.filter(value =>
 value.toLowerCase().includes(searchTerm.toLowerCase())
 );

 const handleToggle = (event: React.MouseEvent) => {
 event.stopPropagation();
 setIsOpen(!isOpen);
 if (!isOpen) {
 setTimeout(() => searchRef.current?.focus(), 100);
 }
 };

 const handleSelect = (value: string, event: React.MouseEvent) => {
 event.stopPropagation();
 const newSelection = selectedValues.includes(value)
 ? selectedValues.filter(v => v !== value)
 : [...selectedValues, value];
 onSelectionChange(newSelection);
 };

 const handleSelectAll = (event: React.MouseEvent) => {
 event.stopPropagation();
 const isAllSelected = selectedValues.length === filteredValues.length && filteredValues.length > 0;
 onSelectionChange(isAllSelected ? [] : filteredValues);
 };

 const getDisplayText = () => {
 if (selectedValues.length === 0) return 'Select Companies...';
 if (selectedValues.length === 1) return selectedValues[0];
 if (selectedValues.length === values.length) return 'All Companies';
 return `${selectedValues.length} companies selected`;
 };

 useEffect(() => {
 const handleClickOutside = (event: MouseEvent) => {
 if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
 setIsOpen(false);
 setSearchTerm('');
 }
 };

 if (isOpen) {
 document.addEventListener('mousedown', handleClickOutside);
 return () => document.removeEventListener('mousedown', handleClickOutside);
 }
 }, [isOpen]);

 const isAllSelected = filteredValues.length > 0 && selectedValues.length === filteredValues.length;
 const isIndeterminate = selectedValues.length > 0 && selectedValues.length < filteredValues.length;

 return (
 <div className="relative" ref={dropdownRef}>
 <div
 className={`w-full border bg-slate-800/70 text-white rounded-lg px-3 py-2 text-xs transition-all duration-200 hover:bg-slate-800/90 cursor-pointer flex justify-between items-center ${
 isOpen 
 ? 'border-blue-400 ring-1 ring-blue-500/50' 
 : selectedValues.length > 0 
 ? 'border-blue-500/60' 
 : 'border-slate-600/60'
 }`}
 onClick={handleToggle}
 >
 <span className="truncate flex-1">
 {getDisplayText()}
 </span>
 <div className="flex items-center gap-2">
 {selectedValues.length > 0 && (
 <span className="bg-blue-600/30 text-blue-200 px-2 py-0.5 rounded text-xs font-medium">
 {selectedValues.length}
 </span>
 )}
 <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
 </div>
 </div>
 
 {isOpen && (
 <div className="absolute top-full left-0 right-0 z-50 bg-slate-800 border border-slate-600/60 rounded-lg mt-1 shadow-xl max-h-80 overflow-hidden">
 {/* Search Input */}
 <div className="p-3 border-b border-slate-700">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
 <input
 ref={searchRef}
 type="text"
 placeholder="Search companies..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="w-full pl-9 pr-8 py-2 bg-slate-700/50 border border-slate-600/60 rounded text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-400"
 onClick={(e) => e.stopPropagation()}
 />
 {searchTerm && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 setSearchTerm('');
 searchRef.current?.focus();
 }}
 className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
 >
 <X className="w-4 h-4" />
 </button>
 )}
 </div>
 </div>
 
 {/* Options */}
 <div className="max-h-60 overflow-y-auto">
 {/* Select All/Deselect All Option - Enhanced Visibility */}
 <div
 className="px-4 py-3.5 text-sm bg-slate-750 hover:bg-slate-700 cursor-pointer border-b-2 border-slate-600/70 transition-all duration-150 flex items-center gap-3 sticky top-0 z-10"
 onClick={handleSelectAll}
 onMouseDown={(e) => e.stopPropagation()}
 >
 <div className="relative">
 <input
 type="checkbox"
 checked={isAllSelected}
 ref={(el) => {
 if (el) el.indeterminate = isIndeterminate;
 }}
 onChange={() => {}}
 className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-400 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
 />
 </div>
 <span className={`font-semibold text-base ${isAllSelected || isIndeterminate ? 'text-blue-300' : 'text-white'}`}>
 {isAllSelected ? '✓ Deselect All' : 'Select All'}
 {filteredValues.length !== values.length && values.length > 0 && (
 <span className="text-slate-400 ml-2 font-normal text-sm">({filteredValues.length} of {values.length})</span>
 )}
 </span>
 </div>
 
 {filteredValues.length > 0 ? (
 filteredValues.map(value => {
 const isSelected = selectedValues.includes(value);
 return (
 <div
 key={value}
 className={`px-4 py-3 text-sm hover:bg-slate-700/70 cursor-pointer transition-colors duration-150 flex items-center gap-3 ${
 isSelected ? 'bg-blue-600/10' : ''
 }`}
 onClick={(e) => handleSelect(value, e)}
 >
 <input
 type="checkbox"
 checked={isSelected}
 onChange={() => {}}
 className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-500 rounded focus:ring-blue-500 focus:ring-2"
 />
 <span className={`flex-1 ${isSelected ? 'text-blue-200 font-medium' : 'text-white'}`}>
 {value}
 </span>
 </div>
 );
 })
 ) : (
 <div className="px-4 py-6 text-sm text-slate-400 text-center">
 {searchTerm ? `No companies found matching "${searchTerm}"` : 'No companies available'}
 </div>
 )}
 </div>
 
 {/* Footer with selection info */}
 {selectedValues.length > 0 && (
 <div className="px-4 py-2 border-t border-slate-700/50 bg-slate-800/50">
 <div className="flex justify-between items-center text-xs">
 <span className="text-slate-400">
 {selectedValues.length} of {values.length} selected
 </span>
 <button
 onClick={(e) => {
 e.stopPropagation();
 onSelectionChange([]);
 }}
 className="text-blue-400 hover:text-blue-300 transition-colors"
 >
 Clear All
 </button>
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 );
 };

 // Updated handleCompanySelectionChange function
 const handleCompanySelectionChange = (selectedCompanies: string[]) => {
 lastChangedKey.current = 'company';
 setSelectedFilters(prev => {
 const newFilters: Record<string, string | string[]> = { 
 ...prev, 
 company: selectedCompanies // Keep as array for multiselect
 };
 
 // Clear dependent filters when company changes
 FILTER_HIERARCHY.slice(1).forEach(key => { 
 newFilters[key] = []; 
 });
 
 return newFilters;
 });
 
 // AUTO-APPLY: Uncomment the next line if you want the table to update immediately when company filter changes
 // setTimeout(() => fetchFilteredData(), 100);
 };

 const handleSingleSelectChange = (key: string, value: string, event: React.MouseEvent) => {
 event.stopPropagation();
 lastChangedKey.current = key;
 setSelectedFilters(prev => {
 // Get current selection
 const currentSelection = getSelectedValues(key);
 
 // Toggle behavior: if clicking the same value, deselect it
 const isAlreadySelected = currentSelection.includes(value) && value !== '';
 const newValue = isAlreadySelected ? [] : (value ? [value] : []);
 
 const newFilters: Record<string, string | string[]> = { ...prev, [key]: newValue };
 const currentIndex = FILTER_HIERARCHY.indexOf(key);
 if (currentIndex !== -1) {
 for (let i = currentIndex + 1; i < FILTER_HIERARCHY.length; i++) {
 newFilters[FILTER_HIERARCHY[i]] = [];
 }
 }
 return newFilters;
 });
 
 // AUTO-APPLY: Uncomment the next line if you want the table to update immediately when other filters change
 // setTimeout(() => fetchFilteredData(), 100);
 };

 const handleSbuChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
 lastChangedKey.current = 'sbu';
 const sbuValue = e.target.value;
 setSelectedFilters({
 sbu: sbuValue,
 company: [],
 zone: [],
 state: [],
 district: [],
 location_name: [],
 });
 
 // The table will be shown automatically through the updated handleSBUClick in the parent component
 };


 const handleClearFilters = () => {
 lastChangedKey.current = null; 
 clearFilters();
 closeAllDropdowns();
 };
 
 const handleApplyFilters = () => {
 fetchFilteredData(); // This will now use the updated fetchFilteredData that calls fetchDataForTable
 closeAllDropdowns();
 }

 const getDisplayText = (key: string): string => {
 const selected = getSelectedValues(key);
 
 if (selected.length === 0) {
 return 'All';
 }
 return selected[0] || 'All';
 };

 const renderCollapsed = () => (
 <div className="p-2 space-y-3 pt-2 relative">
 <div
 className="absolute -right-3 top-2 z-20 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white p-2 rounded-r-lg shadow-lg cursor-pointer transition-all duration-300 transform hover:scale-105"
 onClick={() => setFiltersOpen(true)}
 title="Open Filters"
 >
 <ChevronRight className="w-4 h-4" />
 </div>
 <div className="mt-8 space-y-5">
 {shouldShowUpload() && (
 <div
 className="flex items-center justify-center p-3 rounded-3xl bg-gradient-to-br from-emerald-500/30 to-emerald-600/20 border border-emerald-400/40 text-emerald-300 cursor-pointer hover:from-emerald-500/40 hover:to-emerald-600/30 transition-all duration-200 shadow-lg hover:shadow-emerald-500/30"
 onClick={() => setShowUploadDialog(true)}
 title="Upload File"
 >
 <Upload className="w-4 h-4" />
 </div>
 )}
 {['sbu', ...FILTER_HIERARCHY]
 .filter(key => displayOptions[key] && displayOptions[key].length > 0)
 .map((key) => {
 const isActive = getSelectedValues(key).length > 0;
 return (
 <div
 key={key}
 className={`flex items-center justify-center px-3 py-2 rounded-2xl transition-all duration-200 cursor-pointer group relative ${isActive
 ? 'bg-gradient-to-br from-blue-500/30 to-blue-600/20 border border-blue-400/40 text-blue-300 shadow-lg'
 : 'bg-gradient-to-br from-slate-800/60 to-slate-700/40 hover:from-slate-700/70 hover:to-slate-600/50 text-slate-400 hover:text-slate-300 border border-slate-600/30'
 }`}
 onClick={() => setFiltersOpen(true)}
 title={`${key.replace(/_/g, ' ')} ${isActive ? '(Active)' : ''}`}
 >
 {getFilterIcon(key)}
 {isActive && (
 <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full animate-pulse shadow-lg border border-blue-300/30"></div>
 )}
 </div>
 );
 })}
 </div>
 </div>
 );

 const renderExpanded = () => (
 <div className="h-full overflow-auto relative">
 <div className="flex justify-end p-2 border-b border-slate-700/50">
 <button
 onClick={() => { setFiltersOpen(false); closeAllDropdowns(); }}
 className="p-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all duration-200 shadow-md"
 title="Close Filters"
 >
 <ChevronLeft className="w-4 h-4" />
 </button>
 </div>
 <div className="p-4">
 <div className="flex justify-between items-center gap-2 mb-6">
 <div className="flex-1">
 <div className="relative" ref={el => { dropdownRefs.current['sbu'] = el; }}>
 <div
 className="flex items-center gap-2 bg-slate-800 rounded-lg px-1.5 py-2.5 border border-slate-600/60 cursor-pointer hover:bg-slate-800 transition-all duration-200"
 onClick={(e) => toggleDropdown('sbu', e)}
 >
 {getFilterIcon('sbu')}
 <span className="text-xs text-white flex-1">
 {getSelectedValues('sbu')[0] || 'SBU'}
 </span>
 <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${openDropdowns['sbu'] ? 'rotate-180' : ''}`} />
 </div>
 {openDropdowns['sbu'] && (
 <div className="absolute top-full left-0 right-0 z-50 bg-gray-800 rounded-lg mt-1 shadow-xl max-h-48 overflow-hidden">
 <div className="max-h-48 overflow-y-auto">
 <div
 className={`px-3 py-2 text-xs hover:bg-gray-800 cursor-pointer transition-colors duration-150 ${getSelectedValues('sbu').length === 0 ? 'bg-blue-600/30 text-blue-200' : 'text-white'}`}
 onClick={(e) => {
 e.stopPropagation();
 lastChangedKey.current = 'sbu';
 setSelectedFilters({
 sbu: '',
 company: [],
 zone: [],
 state: [],
 district: [],
 location_name: [],
 });
 setOpenDropdowns(prev => ({ ...prev, sbu: false }));
 }}
 >
 SBU
 </div>
 {displayOptions.sbu?.map(val => (
 <div
 key={val}
 className={`px-3 py-2 text-xs hover:bg-slate-800 cursor-pointer transition-colors duration-150 ${getSelectedValues('sbu').includes(val) ? 'bg-blue-600/30 text-blue-200' : 'text-white'}`}
 onClick={(e) => {
 e.stopPropagation();
 lastChangedKey.current = 'sbu';
 setSelectedFilters({
 sbu: val,
 company: [],
 zone: [],
 state: [],
 district: [],
 location_name: [],
 });
 setOpenDropdowns(prev => ({ ...prev, sbu: false }));
 }}
 >
 {val}
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>
 {shouldShowUpload() && (
 <button
 onClick={() => setShowUploadDialog(true)}
 className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 rounded-lg text-xs font-medium transition-all duration-200 shadow-md hover:shadow-emerald-500/25"
 title="Upload File"
 >
 <Upload className="w-3 h-3" />
 Upload
 </button>
 )}
 </div>
 <div className="space-y-4 mb-6">
 {FILTER_HIERARCHY
 .filter(key => displayOptions[key] && displayOptions[key].length > 0)
 .map((key) => {
 const availableValues = displayOptions[key] || [];
 const filteredValues = getFilteredOptions(key);
 const currentSearchTerm = searchTerms[key] || '';
 
 return (
 <div key={key}>
 <label className="block mb-2 text-xs font-medium text-slate-300 capitalize">{key.replace(/_/g, ' ')}</label>
 {key === 'company' ? (
 <div data-dropdown="company">
 <CompanyDropdownWithSearch 
 values={availableValues} 
 selectedValues={getSelectedValues(key)} 
 onSelectionChange={handleCompanySelectionChange} 
 />
 </div>
 ) : (
 <div className="relative" ref={el => { dropdownRefs.current[key] = el; }}>
 <div
 className="w-full border border-slate-600/60 bg-slate-800/70 text-white rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500/50 focus:border-blue-400 transition-all duration-200 hover:bg-slate-800/90 cursor-pointer flex justify-between items-center"
 onClick={(e) => toggleDropdown(key, e)}
 >
 <span className="truncate">{getDisplayText(key)}</span>
 <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${openDropdowns[key] ? 'rotate-180' : ''}`} />
 </div>
 {openDropdowns[key] && (
 <div className="absolute top-full left-0 right-0 z-50 bg-slate-800 border border-slate-600/60 rounded-lg mt-1 shadow-lg">
 {/* Search Input */}
 <div className="p-2 border-b border-slate-700">
 <div className="relative">
 <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-slate-400" />
 <input
 ref={el => { searchInputRefs.current[key] = el; }}
 type="text"
 placeholder={`Search ${key.replace(/_/g, ' ')}...`}
 value={currentSearchTerm}
 onChange={(e) => handleSearchChange(key, e.target.value)}
 className="w-full pl-7 pr-7 py-1.5 bg-slate-700/50 border border-slate-600/60 rounded text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
 onClick={(e) => e.stopPropagation()}
 />
 {currentSearchTerm && (
 <button
 onClick={(e) => clearSearch(key, e)}
 className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-300"
 >
 <X className="w-3 h-3" />
 </button>
 )}
 </div>
 </div>
 
 {/* Options */}
 <div className="max-h-48 overflow-y-auto">
 {/* All Option (for single-select filters) */}
 <div
 className={`px-3 py-2.5 text-xs hover:bg-slate-700/70 cursor-pointer border-b border-slate-700 transition-colors duration-150 flex items-center gap-3 ${getSelectedValues(key).length === 0 ? 'bg-blue-600/30 text-blue-200 font-medium' : 'text-white'}`}
 onClick={(e) => handleSingleSelectChange(key, '', e)}
 >
 <div className="w-4 h-4 rounded border-2 border-slate-500 flex items-center justify-center bg-slate-700">
 {getSelectedValues(key).length === 0 && (
 <div className="w-2 h-2 rounded-full bg-blue-400"></div>
 )}
 </div>
 <span>All</span>
 </div>
 {filteredValues.length > 0 ? (
 filteredValues.map(val => {
 const isSelected = getSelectedValues(key).includes(val);
 return (
 <div
 key={val}
 className={`px-3 py-2.5 text-xs hover:bg-slate-700/70 cursor-pointer transition-colors duration-150 flex items-center gap-3 ${isSelected ? 'bg-blue-600/30 text-blue-200 font-medium' : 'text-white'}`}
 onClick={(e) => handleSingleSelectChange(key, val, e)}
 >
 <div className="w-4 h-4 rounded border-2 border-slate-500 flex items-center justify-center bg-slate-700">
 {isSelected && (
 <div className="w-2 h-2 rounded-full bg-blue-400"></div>
 )}
 </div>
 <span>{val}</span>
 </div>
 );
 })
 ) : currentSearchTerm ? (
 <div className="px-3 py-2 text-xs text-slate-400 text-center">
 No results found for "{currentSearchTerm}"
 </div>
 ) : (
 <div className="px-3 py-2 text-xs text-slate-400 text-center">
 No options available
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 );
 })}
 </div>
 <div className="flex gap-2 mb-3">
 <button onClick={handleClearFilters} className="flex-1 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-xs font-medium rounded-lg">Clear</button>
 <button onClick={handleApplyFilters} className="flex-1 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg text-xs font-medium">Apply</button>
 </div>
 </div>
 </div>
 );

 return (
 <div
 className={`transition-all duration-300 ${filtersOpen ? 'w-72' : 'w-16'} bg-slate-900/95 backdrop-blur-sm text-white border-r border-slate-600/50 overflow-visible relative`}
 >
 {filtersOpen ? renderExpanded() : renderCollapsed()}
 </div>
 );
};

export default FilterSidebar;