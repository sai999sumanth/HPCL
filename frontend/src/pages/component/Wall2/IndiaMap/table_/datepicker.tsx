import React, { useState } from 'react';
import { Calendar } from 'lucide-react';

interface DateRangePickerProps {
  selectedFromDate: string;
  selectedToDate: string;
  onDateRangeChange: (fromDate: string, toDate: string) => void;
}

const DateRangePickerComponent: React.FC<DateRangePickerProps> = ({
  selectedFromDate,
  selectedToDate,
  onDateRangeChange,
}) => {

  const [open, setOpen] = useState(false);

  const handleFromDateSelect = (date: string) => {
    onDateRangeChange(date, selectedToDate);
  };

  const handleToDateSelect = (date: string) => {
    onDateRangeChange(selectedFromDate, date);
  };

  const formatDateForDisplay = (dateStr: string) => {
    if (!dateStr) return 'Select Date';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleClear = () => {
    onDateRangeChange('', '');
    setOpen(false);
  };

  const getDisplayText = () => {
    if (!selectedFromDate && !selectedToDate) return 'Date Range';
    
    const fromDisplay = selectedFromDate ? 
      new Date(selectedFromDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 
      '';
    const toDisplay = selectedToDate ? 
      new Date(selectedToDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 
      '';
    
    if (fromDisplay && toDisplay) {
      return `${fromDisplay} - ${toDisplay}`;
    } else if (fromDisplay) {
      return `From: ${fromDisplay}`;
    } else if (toDisplay) {
      return `To: ${toDisplay}`;
    }
    
    return 'Date Range';
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-lg text-xs font-medium transition-all duration-200 shadow-md hover:shadow-purple-500/25 text-white"
      >
        <Calendar className="w-3 h-3" />
        
        {(selectedFromDate || selectedToDate) && (
          <span className="ml-1 px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-xs max-w-20 truncate">
            {getDisplayText()}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-50 p-4 min-w-[120px]">
          <div className="mb-3 text-center">
            <span className="text-sm font-medium text-gray-800">
              Select Date Range
            </span>
          </div>
          
          {/* Date range inputs */}
          <div className="space-y-4">
            {/* From Date */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                From Date
              </label>
              <input
                type="date"
                value={selectedFromDate}
                max={selectedToDate || undefined} // Prevent from date being after to date
                onChange={(e) => handleFromDateSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 text-gray-700 bg-white"
              />
            </div>

            {/* To Date */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                To Date
              </label>
              <input
                type="date"
                value={selectedToDate}
                min={selectedFromDate || undefined} // Prevent to date being before from date
                onChange={(e) => handleToDateSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 text-gray-700 bg-white"
              />
            </div>

            {/* Selected Range Display */}
            {(selectedFromDate || selectedToDate) && (
              <div className="p-2 bg-purple-50 border border-purple-200 rounded-md">
                <div className="text-xs text-purple-800">
                  <span className="font-medium">Selected Range:</span>
                  <br />
                  {selectedFromDate && (
                    <span>From: {formatDateForDisplay(selectedFromDate)}</span>
                  )}
                  {selectedFromDate && selectedToDate && <br />}
                  {selectedToDate && (
                    <span>To: {formatDateForDisplay(selectedToDate)}</span>
                  )}
                </div>
              </div>
            )}
            
            <div className="flex justify-between gap-2">
              <button
                onClick={handleClear}
                className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 hover:border-gray-400 rounded text-xs font-medium transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white border border-purple-600 hover:border-purple-700 rounded text-xs font-medium transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePickerComponent;