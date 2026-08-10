import React, { useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../@/components/ui/select';
import { ChartType } from "../../../../../types/chartTabs";
import { useSelector } from 'react-redux';
import { RootState } from '../../../../../redux/store';

interface ChartDropdownProps {
  activeChartType: string;
  chartTypes: ChartType[];
  onChartTypeChange: (type: string) => void;
}

export const ChartDropdown: React.FC<ChartDropdownProps> = ({ 
  activeChartType, 
  chartTypes, 
  onChartTypeChange 
}) => (
  <Select value={activeChartType} onValueChange={onChartTypeChange}>
    <SelectTrigger className="w-full">
      <SelectValue placeholder="Select a chart type">
        {activeChartType && (
          <div className="flex items-center">
            <img
              src={chartTypes.find((ct) => ct.unique_id === activeChartType)?.icon}
              alt={chartTypes.find((ct) => ct.unique_id === activeChartType)?.name}
              className="w-6 h-6 mr-2"
            />
            <span>
              {chartTypes.find((ct) => ct.unique_id === activeChartType)?.name}
            </span>
          </div>
        )}
      </SelectValue>
    </SelectTrigger>
    <SelectContent>
      {chartTypes.map((chartType) => (
        <SelectItem key={chartType.unique_id} value={chartType.unique_id}>
          <div className="flex items-center">
            <img
              src={chartType.icon}
              alt={chartType.name}
              className="w-6 h-6 mr-2"
            />
            <span>{chartType.name}</span>
          </div>
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);
