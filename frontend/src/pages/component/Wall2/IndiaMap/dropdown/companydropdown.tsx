import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface CompanyDropdownProps {
  values: string[];
  selectedValues: string[];
  onSelectionChange: (selectedCompanies: string[]) => void;
}

const CompanyDropdown: React.FC<CompanyDropdownProps> = ({
  values,
  selectedValues,
  onSelectionChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (company: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const isSelected = selectedValues.includes(company);
    let newSelection: string[];
    
    if (isSelected) {
      newSelection = selectedValues.filter(c => c !== company);
    } else {
      newSelection = [...selectedValues, company];
    }
    
    onSelectionChange(newSelection);
  };

  const handleSelectAll = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (selectedValues.length === 0) {
      onSelectionChange([]);
    } else {
      onSelectionChange([]);
    }
  };

  const getDisplayText = () => {
    if (selectedValues.length === 0) return 'All Companies';
    if (selectedValues.length === 1) return selectedValues[0];
    return `${selectedValues.length} companies selected`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        className="w-full border border-slate-600/60 bg-slate-800/70 text-white rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500/50 focus:border-blue-400 transition-all duration-200 hover:bg-slate-800/90 cursor-pointer flex justify-between items-center"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate">{getDisplayText()}</span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      
      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 bg-slate-800 border border-slate-600/60 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg">
          <div
            className={`px-3 py-2 text-xs hover:bg-slate-700/70 cursor-pointer border-b border-slate-700 transition-colors duration-150 flex items-center justify-between ${selectedValues.length === 0 ? 'bg-blue-600/30 text-blue-200' : 'text-white'}`}
            onClick={handleSelectAll}
          >
            <span>All Companies</span>
            {selectedValues.length === 0 && <Check className="w-4 h-4 text-blue-400" />}
          </div>
          {values.map(company => (
            <div
              key={company}
              className={`px-3 py-2 text-xs hover:bg-slate-700/70 cursor-pointer transition-colors duration-150 flex items-center justify-between ${selectedValues.includes(company) ? 'bg-blue-600/30 text-blue-200' : 'text-white'}`}
              onClick={(e) => handleToggle(company, e)}
            >
              <span>{company}</span>
              {selectedValues.includes(company) && <Check className="w-4 h-4 text-blue-400" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CompanyDropdown;
