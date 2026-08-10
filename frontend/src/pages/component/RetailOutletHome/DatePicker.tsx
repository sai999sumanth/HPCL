import React, { useState } from 'react';
import { Calendar } from 'lucide-react';

const DatePicker = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onSubmit,
  onCancel
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Custom styles for date inputs to override browser defaults
  const dateInputStyle = {
    colorScheme: 'dark', // For the calendar popup
    // Override default calendar icon
    '::-webkit-calendar-picker-indicator': {
      filter: 'invert(1)'
    }
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-200 flex items-center"
      >
        <Calendar className="w-3 h-3" />
      </button>

      {isOpen && (
        <div className="absolute top-12 right-0 z-50">
          <div className="bg-gray-900 rounded-lg shadow-xl border border-gray-700 p-4 w-96">
            <div className="flex justify-between mb-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-200">From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => onStartDateChange(e.target.value)}
                  className="block w-40 rounded-md border-gray-600 bg-gray-800 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  style={dateInputStyle}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-200">To</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => onEndDateChange(e.target.value)}
                  className="block w-40 rounded-md border-gray-600 bg-gray-800 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  style={dateInputStyle}
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onCancel();
                }}
                className="px-4 py-2 text-sm font-medium text-gray-200 bg-gray-800 border border-gray-700 rounded-md hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setIsOpen(false);
                  onSubmit();
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
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

export default DatePicker;