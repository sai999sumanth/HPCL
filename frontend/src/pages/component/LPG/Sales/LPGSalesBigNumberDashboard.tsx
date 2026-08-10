import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/@/components/ui/select";
import { apiClient } from '@/services/apiClient';

function getYesterdayDate() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).replace(/\s/g, '-');
}

function getCurrentMonth() {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const currentDate = new Date();
  return months[currentDate.getMonth()];
}

function getCurrentFinancialYear() {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1; // JavaScript months are 0-indexed
  
  // Financial year is April to March
  if (month >= 4) {
    return `${currentYear}-${currentYear + 1}`;
  } else {
    return `${currentYear - 1}-${currentYear}`;
  }
}

const Toggle: React.FC<{
  type: string;
  isActive: boolean;
  onToggle: () => void;
}> = ({ type, isActive, onToggle }) => (
  <div 
    className={`absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded-full cursor-pointer border ${
      isActive 
        ? 'bg-blue-600 text-white border-blue-600' 
        : 'bg-gray-100 text-blue-600 border-blue-400'
    }`}
    onClick={onToggle}
  >
    <span className="text-xs font-bold">{type}</span>
  </div>
);

const LoadingSpinner: React.FC = () => (
  <div className="flex justify-center items-center h-full">
    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-600"></div>
  </div>
);

const cardConfigs = [
  { 
    title: 'Current Year Sales', 
    drillState: 'cdcms_current_year_sales', 
    responseKey: 'total_sales', 
    showCR: true, 
    showLakhs: false, 
    showCylinders: false,
    hasToggle: true,
    toggleType: 'FY',
    dropdownType: 'financial_year',
    dropdownOptions: ['2023-2024', '2024-2025', '2025-2026'],
    showYearDropdownOnly: true
  },
  { 
    title: 'Current Month Sales', 
    drillState: 'cdcms_current_month_sales', 
    responseKey: 'total_sales', 
    showCR: true, 
    showLakhs: false, 
    showCylinders: false,
    hasToggle: true,
    toggleType: 'F',
    dropdownType: 'financial_year',
    dropdownOptions: ['2023-2024', '2024-2025', '2025-2026'],
    showMonthAfterYear: true,
    sideBySideDropdowns: true
  },
  { 
    title: 'Current Week Sales', 
    drillState: 'cdcms_current_week_sales', 
    responseKey: 'total_sales', 
    showCR: true, 
    showLakhs: false, 
    showCylinders: false 
  },
  { 
    title: `Total Sales (${getYesterdayDate()})`, 
    drillState: 'cdcms_current_date_sales', 
    responseKey: 'total_sales',
    cylinderKey: 'no_of_cylinders',
    showCR: true, 
    showLakhs: false,
    showCylinders: true
  },
  { 
    title: `Total Bookings (${getYesterdayDate()})`, 
    drillState: 'cdcms_current_date_bookings', 
    responseKey: 'Bookings',
    cylinderKey: 'no_of_cylinders', 
    showCR: true, 
    showLakhs: false,
    showCylinders: true
  },
  { 
    title: `Total Pendings (${getYesterdayDate()})`, 
    drillState: 'cdcms_current_date_pending', 
    responseKey: 'Pending',
    cylinderKey: 'no_of_cylinders',
    showCR: false, 
    showLakhs: true,
    showCylinders: true
  },
];

const BigNumberCard: React.FC<{
  title: string;
  value: string | number;
  cylinderValue?: string | number;
  showCR: boolean;
  showLakhs: boolean;
  showCylinders: boolean;
  hasToggle?: boolean;
  toggleType?: string;
  toggleActive?: boolean;
  onToggle?: () => void;
  dropdownType?: string;
  dropdownOptions?: string[];
  selectedValue?: string;
  onValueChange?: (value: string) => void;
  showMonthAfterYear?: boolean;
  showYearDropdownOnly?: boolean;
  sideBySideDropdowns?: boolean;
  selectedMonth?: string;
  monthOptions?: string[];
  onMonthChange?: (value: string) => void;
  isLoading?: boolean;
}> = ({ 
  title, 
  value, 
  cylinderValue, 
  showCR, 
  showLakhs, 
  showCylinders, 
  hasToggle, 
  toggleType,
  toggleActive,
  onToggle,
  dropdownType,
  dropdownOptions,
  selectedValue,
  onValueChange,
  showMonthAfterYear,
  showYearDropdownOnly,
  sideBySideDropdowns,
  selectedMonth,
  monthOptions,
  onMonthChange,
  isLoading
}) => (
  <div className="h-32 p-0 w-full flex flex-col justify-start rounded-lg bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 shadow-sm border border-blue-200 hover:shadow-md transition-shadow duration-200 relative">
    <div className="text-center w-full h-8 flex items-center justify-center">
      <h2 className="text-sm font-medium text-blue-600 px-2 truncate">{title}</h2>
    </div>
    
    {toggleActive && dropdownOptions && (
      <div className={`w-full px-2 pb-1 ${sideBySideDropdowns ? "flex gap-1" : ""}`}>
        {/* Financial Year dropdown */}
        <div className={sideBySideDropdowns ? "w-1/2" : "w-full"}>
          <Select 
            value={selectedValue} 
            onValueChange={onValueChange}
          >
            <SelectTrigger className="h-6 text-xs">
              <SelectValue placeholder="Select FY" />
            </SelectTrigger>
            <SelectContent>
              {dropdownOptions.map((option) => (
                <SelectItem key={option} value={option} className="text-xs">
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Show Month dropdown based on conditions */}
        {toggleActive && showMonthAfterYear && selectedValue && monthOptions && !showYearDropdownOnly && (
          <div className={sideBySideDropdowns ? "w-1/2" : "w-full mt-1"}>
            <Select 
              value={selectedMonth} 
              onValueChange={onMonthChange}
            >
              <SelectTrigger className="h-6 text-xs">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option} value={option} className="text-xs">
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    )}
    
    <div className="w-full border-b border-blue-200" />
    
    {isLoading ? (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    ) : showCylinders ? (
      <div className="flex-1 flex flex-col justify-center px-6 space-y-1">
        <div className="flex items-center">
          <span className="text-sm text-blue-900 w-20">Volume</span>
          <span className="text-sm text-blue-900 mr-2" style={{position: 'relative', right: '5px'}}>:</span>
          <span className="text-lg font-bold text-blue-900">{value}</span>
          <span className="text-xs text-blue-600 ml-1">(TMT)</span>
        </div>
        <div className="flex items-center">
          <span className="text-sm text-blue-900 w-20">Cylinders</span>
          <span className="text-sm text-blue-900 mr-2">:</span>
          <span className="text-lg font-bold text-blue-900">{cylinderValue}</span>
          <span className="text-xs text-blue-600 ml-1">(lakhs)</span>
        </div>
      </div>
    ) : (
      <div className="flex-1 flex items-center justify-center px-2">
        <p className="text-lg font-bold text-blue-900">
          {value}
          {showCR && (
            <span className="text-xs text-blue-600 ml-1">(TMT)</span>
          )}
          {showLakhs && (
            <span className="text-xs text-blue-600 ml-1">lakhs</span>
          )}
        </p>
      </div>
    )}
    
    {hasToggle && toggleType && onToggle && (
      <Toggle 
        type={toggleType} 
        isActive={toggleActive || false} 
        onToggle={onToggle} 
      />
    )}
  </div>
);

const LPGSalesDashboard: React.FC = () => {
  const [cardData, setCardData] = useState<Record<string, any>>({});
  const [toggleStates, setToggleStates] = useState<Record<string, boolean>>({
    cdcms_current_year_sales: false,
    cdcms_current_month_sales: false
  });
  
  // Changed from a single state object to individual card states
  const [cardValues, setCardValues] = useState<Record<string, {
    financial_year?: string,
    Month?: string
  }>>({
    cdcms_current_year_sales: { financial_year: '' },
    cdcms_current_month_sales: { financial_year: '', Month: '' }
  });
  
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  // Function to fetch data for a specific card
  const fetchCardData = async (card: typeof cardConfigs[0], customValues?: Record<string, string>) => {
    const drillState = card.drillState;
    
    // Set loading state for this specific card
    setLoadingStates(prev => ({
      ...prev,
      [drillState]: true
    }));
    
    try {
      // Determine which drill state to use based on toggle state and dropdown selection
      let drillStateToUse = drillState;
      
      if (card.hasToggle && toggleStates[drillState]) {
        // Get values from either customValues or cardValues
        const cardValue = cardValues[drillState] || {};
        const financialYear = customValues?.financial_year || cardValue.financial_year;
        const month = customValues?.Month || cardValue.Month;
        
        // Build the drill state query parameters
        let params = [];
        
        // Add financial year if it's selected
        if (financialYear) {
          params.push(`financial_year=${financialYear}`);
          
          // Only add month if:
          // 1. The card supports showing both year and month (showMonthAfterYear)
          // 2. The month is actually selected
          // 3. The card is not configured to show only the year dropdown
          if (month && card.showMonthAfterYear && !card.showYearDropdownOnly) {
            params.push(`Month=${month}`);
          }
        }
        
        if (params.length > 0) {
          drillStateToUse = `${drillState},${params.join(',')}`;
        }
      }
      
      const response = await apiClient.post('/api/charts/generate_vis_data', {
        filters: [],
        action: 'card_chart',
        drill_state: drillStateToUse,
        cross_filters: [],
      });

      if (response.data?.status) {
        const data = response.data.data[0];
        const result: any = { 
          primaryValue: data?.[card.responseKey] ?? 'N/A' 
        };
        
        if (card.cylinderKey && data?.[card.cylinderKey]) {
          result.cylinderValue = data[card.cylinderKey];
        }
        
        setCardData(prev => ({
          ...prev,
          [drillState]: result
        }));
      } else {
        setCardData(prev => ({
          ...prev,
          [drillState]: { primaryValue: 'Error' }
        }));
      }
    } catch (error) {
      console.error(`Error fetching data for ${drillState}:`, error);
      setCardData(prev => ({
        ...prev,
        [drillState]: { primaryValue: 'Error' }
      }));
    } finally {
      // Clear loading state for this specific card
      setLoadingStates(prev => ({
        ...prev,
        [drillState]: false
      }));
    }
  };

  // Initial data fetch
  useEffect(() => {
    // Fetch data for all cards on initial load
    cardConfigs.forEach(card => {
      fetchCardData(card);
    });
  }, []);

  // Handle toggle state changes
  const handleToggle = (drillState: string) => {
    setToggleStates(prev => {
      const newState = {
        ...prev,
        [drillState]: !prev[drillState]
      };
      
      // If toggle is turned off, clear selected values for this card
      if (!newState[drillState]) {
        setCardValues(prev => ({
          ...prev,
          [drillState]: { financial_year: '', Month: '' }
        }));
      }
      
      return newState;
    });
  };

  // Handle financial year change for a specific card
  const handleFinancialYearChange = (value: string, cardDrillState: string) => {
    setCardValues(prev => ({
      ...prev,
      [cardDrillState]: {
        ...prev[cardDrillState],
        financial_year: value,
        // Reset month when changing year in cards that support month selection
        ...(cardConfigs.find(c => c.drillState === cardDrillState)?.showMonthAfterYear && 
           !cardConfigs.find(c => c.drillState === cardDrillState)?.showYearDropdownOnly 
           ? { Month: '' } : {})
      }
    }));
    
    // Fetch data for this specific card with the new financial year
    const cardConfig = cardConfigs.find(card => card.drillState === cardDrillState);
    if (cardConfig) {
      fetchCardData(cardConfig, { financial_year: value });
    }
  };

  // Handle month change for a specific card
  const handleMonthChange = (value: string, cardDrillState: string) => {
    setCardValues(prev => ({
      ...prev,
      [cardDrillState]: {
        ...prev[cardDrillState],
        Month: value
      }
    }));
    
    // Update the specific card with the new month
    const cardConfig = cardConfigs.find(card => card.drillState === cardDrillState);
    if (cardConfig && cardValues[cardDrillState]?.financial_year) {
      fetchCardData(cardConfig, { 
        financial_year: cardValues[cardDrillState].financial_year || '',
        Month: value 
      });
    }
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 p-1">
      {cardConfigs.map((item, index) => {
        // Get card-specific values
        const cardValue = cardValues[item.drillState] || {};
        
        return (
          <BigNumberCard
            key={index}
            title={item.title}
            value={cardData[item.drillState]?.primaryValue || 'N/A'}
            cylinderValue={item.showCylinders ? cardData[item.drillState]?.cylinderValue : undefined}
            showCR={item.showCR}
            showLakhs={item.showLakhs}
            showCylinders={item.showCylinders}
            hasToggle={item.hasToggle}
            toggleType={item.toggleType}
            toggleActive={item.hasToggle ? toggleStates[item.drillState] : undefined}
            onToggle={item.hasToggle ? () => handleToggle(item.drillState) : undefined}
            dropdownType={item.dropdownType}
            dropdownOptions={item.dropdownOptions}
            selectedValue={item.dropdownType === 'financial_year' ? cardValue.financial_year : undefined}
            onValueChange={(value) => handleFinancialYearChange(value, item.drillState)}
            showMonthAfterYear={item.showMonthAfterYear}
            showYearDropdownOnly={item.showYearDropdownOnly}
            sideBySideDropdowns={item.sideBySideDropdowns}
            selectedMonth={item.showMonthAfterYear && !item.showYearDropdownOnly ? cardValue.Month : undefined}
            monthOptions={item.showMonthAfterYear && !item.showYearDropdownOnly ? 
              ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] : 
              undefined}
            onMonthChange={(value) => handleMonthChange(value, item.drillState)}
            isLoading={loadingStates[item.drillState]}
          />
        );
      })}
    </div>
  );
};

export default LPGSalesDashboard;