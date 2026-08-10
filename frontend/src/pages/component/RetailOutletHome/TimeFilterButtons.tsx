import { Tooltip } from '@mui/material';
import React, { useState, useEffect } from 'react';

interface TimeFilterProps {
  selectedFilter: string | null;
  onFilterChange: (filter: string | null) => void;
  onDateRangeChange: (dateFilter: any) => void;
  resetTrigger?: number;
}

const EnhancedTimeFilter: React.FC<TimeFilterProps> = ({
  selectedFilter,
  onFilterChange,
  onDateRangeChange,
  resetTrigger = 0
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCustomDateSelected, setIsCustomDateSelected] = useState(false);
  useEffect(() => {
    // Reset all internal state
    setStartDate('');
    setEndDate('');
    setIsCustomDateSelected(false);
    setShowDatePicker(false);
  }, [resetTrigger]);
  const filters = [
    { label: 'TDY', value: 't', tooltip: 'Today' },
    { label: 'YDY', value: '1d', tooltip: 'Yesterday' },
    { label: '1W', value: '1w', tooltip: 'Last 1 Week' },
    { label: '15D', value: '15d', tooltip: 'Last 15 Days' },
    { label: '1M', value: '1m', tooltip: 'Last 1 Month' },
    { label: '3M', value: '3m', tooltip: 'Last 3 Months' },
  ];

  const handleDateSubmit = () => {
    if (startDate && endDate) {
      // Format dates for API
      const dateRangeValue = `${startDate},${endDate}`;

      // Create the date range filter object
      const dateFilter = {
        key: 'created_at',
        cond: 'date_range',
        value: dateRangeValue
      };

      // Pass the filter object to parent
      onDateRangeChange(dateFilter);
      setIsCustomDateSelected(true);
      setShowDatePicker(false);

      // Reset standard filter selection
      onFilterChange(null);
    }
  };

  const handleFilterClick = (filterValue: string) => {
    setIsCustomDateSelected(false);
    setStartDate('');
    setEndDate('');
    onFilterChange(filterValue);
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = e.target.value;
    setStartDate(newStart);
    // Clear end date only if it's before the new start date (allow same date)
    if (endDate && newStart > endDate) {
      setEndDate('');
    }
  };
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 items-center justify-end w-max">
        {filters.map((filter) => (
          <Tooltip key={filter.value} title={filter.tooltip}>
            <button
              onClick={() => handleFilterClick(filter.value)}
              className={`px-2 py-1 text-xs font-medium rounded-lg transition-all
        ${selectedFilter === filter.value
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                  : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 hover:from-gray-200 hover:to-gray-300 border border-gray-300'
                }`}
            >
              {filter.label}
            </button>
          </Tooltip>
        ))}
        <Tooltip title="Select Date Range">
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className={`px-2 py-1 text-xs font-medium rounded-lg transition-all
      ${isCustomDateSelected
                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 hover:from-gray-200 hover:to-gray-300 border border-gray-300'
              }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </button>
        </Tooltip>
      </div>

      {showDatePicker && (
        <div className="absolute top-12 right-0 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-96">
          <div className="flex justify-between mb-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">From</label>
              <input
                type="date"
                value={startDate}
                 max={today}  
                onChange={handleStartDateChange}
                className="block w-40 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">To</label>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                max={today}
                onChange={(e) => setEndDate(e.target.value)}
                className="block w-40 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end space-x-2">
            <button
              onClick={() => {
                setShowDatePicker(false);
                setIsCustomDateSelected(false);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDateSubmit}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-500 rounded-md hover:from-blue-600 hover:to-purple-600"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedTimeFilter;