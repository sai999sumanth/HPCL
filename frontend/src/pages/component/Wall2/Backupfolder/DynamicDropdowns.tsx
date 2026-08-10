import React, { useState, useEffect, useCallback } from 'react';
import {
  convertListOfStringsToCommonFormat,
  convertToSpecificFormat,
} from './utils/sales.utils';
import { fetchChartData } from '../api';

// Types for filters and components
interface Filter {
  company: string;
  type: string;
  operator: string;
  value: number;
}

interface SelectProps {
  label: string;
  value: string | number;
  onChange: (value: string | number) => void;
  options: string[] | number[];
}

interface DynamicFiltersComponentProps {}

// Reusable Select component
const Select: React.FC<SelectProps> = ({ label, value, onChange, options }) => (
  <div className="flex flex-col sm:flex-row sm:space-x-4">
    <select
      className="my-1 p-2 border border-gray-300 rounded-md bg-white text-gray-700 transition duration-300 ease-in-out shadow-sm text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{`Select ${label}`}</option>
      {options.map((option, idx) => (
        <option key={idx} value={option}>
          {option}
        </option>
      ))}
    </select>
  </div>
);

// Main Dynamic Filters Component
const DynamicFiltersComponent: React.FC<DynamicFiltersComponentProps> = () => {
  const defaultFilter: Filter = {
    company: 'HPCL',
    type: 'by company',
    operator: '',
    value: 0,
  };

  const [filters, setFilters] = useState<Filter[]>([defaultFilter]);
  const [selectedButtons, setSelectedButtons] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [statistics, setStatistics] = useState<any>([]);

  const categories = ['by company', 'by omc'];
  const companies = [
    'HPCL',
    'BPCL',
    'IOCL',
    'RIL',
    'SHELL',
    'OIL',
    'ONGC',
    'NEL',
    'BORL',
    'NRL',
    'GAIL',
    'BPCL',
    'HMEL',
    'MRPL',
    'SMA',
    'CPCL',
  ];
  const omcs = ['PSU', 'MPSU', 'OtherPSU', 'PVT'];
  const operators = ['<', '<=', '>', '>=', '==', '!='];
  const values = Array.from({ length: 101 }, (_, i) => i - 50);

  // Ensure at least one filter row exists
  useEffect(() => {
    if (filters.length === 0) {
      setFilters([defaultFilter]);
    }
  }, [filters]);

  // Handle adding a new filter row
  const addFilterRow = useCallback(() => {
    setFilters((prevFilters) => [
      ...prevFilters,
      { company: 'HPCL', type: 'by company', operator: '', value: 0 },
    ]);
  }, []);

  // Handle deleting a filter row
  const deleteFilterRow = useCallback((index: number) => {
    setFilters((prevFilters) => prevFilters.filter((_, idx) => idx !== index));
  }, []);

  // Handle change for a specific row
  const handleChange = useCallback(
    (index: number, field: string, value: string | number) => {
      setFilters((prevFilters) =>
        prevFilters.map((filter, idx) =>
          idx === index ? { ...filter, [field]: value } : filter
        )
      );
    },
    []
  );

  const loadStatistics = async (body: any) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetchChartData(body);
      if (response.status && response.data) {
        setStatistics([]);
      } else {
        setError('No data available');
      }
    } catch (err) {
      setError('Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle applying filters
  const handleApply = () => {
    console.log('Filters applied:', filters);
    loadStatistics({
      filters: [
        ...convertToSpecificFormat(filters),
        ...convertListOfStringsToCommonFormat(selectedButtons),
      ],
      cross_filters: [],
      action: 'm60_performance',
      drill_state: '',
    });
  };

  // Handle button selection
  const handleButtonClick = (button: string) => {
    setSelectedButtons((prevButtons) =>
      prevButtons.includes(button)
        ? prevButtons.filter((b) => b !== button)
        : [...prevButtons, button]
    );
  };

  // Check if button is selected
  const isSelected = (button: string) => selectedButtons.includes(button);

  // Clear all filters and reset to default
  const handleClear = () => {
    setFilters([defaultFilter]);
    setSelectedButtons([]); // Reset selected buttons as well
    setStatistics([]); // Reset statistics
  };

  return (
    <div className="space-y-4 p-4 max-w-4xl mx-auto">
      <div className="flex flex-col space-y-4">
        {filters.map((filter, index) => (
          <div key={index} className="flex flex-col space-y-2">
            <div className="flex flex-col sm:flex-row sm:space-x-4">
              <Select
                label="omc_or_company"
                value={filter.type}
                onChange={(value) => handleChange(index, 'type', value)}
                options={categories}
              />

              {/* Conditionally render options based on filter.type */}
              {filter.type === 'by company' && (
                <Select
                  label="company_name"
                  value={filter.company}
                  onChange={(value) => handleChange(index, 'company', value)}
                  options={companies}
                />
              )}

              {filter.type === 'by omc' && (
                <Select
                  label="omc_name"
                  value={filter.company}
                  onChange={(value) => handleChange(index, 'company', value)}
                  options={omcs}
                />
              )}

              <Select
                label="Operator"
                value={filter.operator}
                onChange={(value) => handleChange(index, 'operator', value)}
                options={operators}
              />
              <Select
                label="Value"
                value={filter.value}
                onChange={(value) =>
                  handleChange(index, 'value', Number(value))
                }
                options={values}
              />

              {/* Delete Icon: Do not show for the first row */}
              {index !== 0 && (
                <button
                  type="button"
                  className="my-1 p-2 text-white bg-red-500 rounded-full sm:w-auto"
                  onClick={() => deleteFilterRow(index)}
                >
                  -
                </button>
              )}

              {/* Add Filter Row */}
              <button
                type="button"
                className="my-1 p-2 text-white bg-green-500 rounded-full sm:w-auto"
                onClick={addFilterRow}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center space-x-2">
        <div className="flex space-x-2">
          {['A', 'H'].map((button) => (
            <button
              key={button}
              type="button"
              className={`my-1 font-bold py-2 px-4 mx-1 ${
                isSelected(button)
                  ? 'bg-teal-800 text-white shadow-lg'
                  : 'bg-gray-200 text-black'
              }`}
              onClick={() => handleButtonClick(button)}
            >
              {button}
            </button>
          ))}
        </div>
        <div className="flex space-x-2">
          <button
            type="button"
            className="w-full sm:w-auto bg-blue-500 hover:bg-blue-700 text-sm text-white font-semibold py-2 px-4 rounded-full shadow-lg transition duration-300 ease-in-out"
            onClick={handleApply}
          >
            Apply
          </button>
          <button
            type="button"
            className="w-full sm:w-auto bg-gray-500 hover:bg-gray-700 text-sm text-white font-semibold py-2 px-4 rounded-full shadow-lg transition duration-300 ease-in-out"
            onClick={handleClear}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
};

export default DynamicFiltersComponent;
