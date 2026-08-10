import { Tooltip } from '@mui/material';
import React, { useState, useEffect } from 'react';

interface TimeFilterProps {
  selectedFilter: string | null | { key: string; cond: string; value: string };
  onFilterChange: (filter: string | null | { key: string; cond: string; value: string }) => void;
  resetTrigger?: number;
  isLoading?: boolean;
  /**
   * When true, only the date-range (calendar) control is shown — no TDY / 1W / 1M / 3M presets.
   * Default false: unchanged behavior for all existing consumers.
   */
  calendarOnly?: boolean;
  /**
   * When true, both date pickers are limited to yesterday and today (inclusive).
   * Default false; opt-in only (e.g. TAS Product Insight via a local wrapper).
   */
  onlyTodayAndYesterday?: boolean;
}

const EnhancedTimeFilter: React.FC<TimeFilterProps> = ({
  selectedFilter,
  onFilterChange,
  resetTrigger = 0,
  isLoading = false,
  calendarOnly = false,
  onlyTodayAndYesterday = false,
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCustomDateSelected, setIsCustomDateSelected] = useState(false);

  useEffect(() => {
    if (resetTrigger > 0) {
      setStartDate('');
      setEndDate('');
      setShowDatePicker(false);
      setIsCustomDateSelected(false);
    }
  }, [resetTrigger]);

  useEffect(() => {
    if (selectedFilter) {
      setIsCustomDateSelected(false);
    }
  }, [selectedFilter]);

  const filters = [
    { label: 'TDY', value: 'TDY', tooltip: 'Today' },
    { label: 'YDY', value: 'YDY', tooltip: 'Yesterday' },
    { label: '1W', value: '1W', tooltip: 'Last 1 Week' },
    { label: '15D', value: '15D', tooltip: 'Last 15 Days' },
    { label: '1M', value: '1M', tooltip: 'Last 1 Month' },
    { label: '3M', value: '3M', tooltip: 'Last 3 Months' },
  ];

  const todayIso = new Date().toISOString().split('T')[0];
  const yesterdayD = new Date();
  yesterdayD.setUTCDate(yesterdayD.getUTCDate() - 1);
  const yesterdayIso = yesterdayD.toISOString().split('T')[0];

  const handleDateSubmit = () => {
    if (!startDate || !endDate) return;
    if (onlyTodayAndYesterday) {
      if (
        startDate < yesterdayIso ||
        endDate > todayIso ||
        startDate > endDate ||
        endDate < yesterdayIso
      ) {
        return;
      }
    }
    const dateRangeValue = `${startDate},${endDate}`;
    const dateFilter = {
      key: 'Date',
      cond: 'equals',
      value: dateRangeValue
    };
    onFilterChange(dateFilter);
    setIsCustomDateSelected(true);
    setShowDatePicker(false);
  };

  const handleFilterClick = (filterValue: string) => {
    setIsCustomDateSelected(false);
    setStartDate('');
    setEndDate('');
    onFilterChange(filterValue);
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newStart = e.target.value;
    if (onlyTodayAndYesterday && newStart) {
      if (newStart < yesterdayIso) newStart = yesterdayIso;
      if (newStart > todayIso) newStart = todayIso;
    }
    setStartDate(newStart);
    // Clear end date only if it's before the new start date (allow same date)
    if (endDate && newStart > endDate) {
      setEndDate('');
    }
  };

  const fromMin = onlyTodayAndYesterday ? yesterdayIso : undefined;
  const fromMax = onlyTodayAndYesterday ? todayIso : undefined;
  const toMin = onlyTodayAndYesterday
    ? (startDate && startDate >= yesterdayIso ? startDate : yesterdayIso)
    : startDate || undefined;
  const toMax = todayIso;

  const panelTopClass = calendarOnly ? 'top-9' : 'top-10';
  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 items-center justify-end w-max">
        {!calendarOnly
          ? filters.map((filter) => (
              <Tooltip key={filter.value} title={filter.tooltip} placement="top">
                <button
                  onClick={() => handleFilterClick(filter.value)}
                  disabled={isLoading}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all h-7
                ${selectedFilter === filter.value
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-300'
                }`}
                >
                  {filter.label}
                </button>
              </Tooltip>
            ))
          : null}
        <Tooltip
          title={onlyTodayAndYesterday ? 'Select date (today or yesterday only)' : 'Select Date Range'}
          placement="top"
        >
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            disabled={isLoading}
            className={`p-1.5 rounded-md transition-all h-7 w-7 border
      ${isCustomDateSelected || (selectedFilter && typeof selectedFilter === 'object')
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-sm border-transparent'
                : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-300'
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
        <div
          className={`absolute ${panelTopClass} right-0 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-auto`}
        >
          {onlyTodayAndYesterday ? (
            <p className="mb-3 max-w-[280px] text-xs text-gray-500">
              Only <span className="font-medium text-gray-700">today</span> and{' '}
              <span className="font-medium text-gray-700">yesterday</span> can be selected.
            </p>
          ) : null}
          <div className="flex justify-between gap-4 mb-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">From</label>
              <input
                type="date"
                value={startDate}
                onChange={handleStartDateChange}
                min={fromMin}
                max={fromMax}
                disabled={isLoading}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-9 px-2"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  let next = e.target.value;
                  if (onlyTodayAndYesterday && next) {
                    if (next < yesterdayIso) next = yesterdayIso;
                    if (next > todayIso) next = todayIso;
                    if (startDate && next < startDate) next = startDate;
                  }
                  setEndDate(next);
                }}
                min={toMin}
                max={toMax}
                disabled={isLoading}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-9 px-2"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end space-x-2">
            <button
              onClick={() => {
                setShowDatePicker(false);
              }}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDateSubmit}
              disabled={isLoading || !startDate || !endDate}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-md hover:from-indigo-600 hover:to-purple-600"
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
