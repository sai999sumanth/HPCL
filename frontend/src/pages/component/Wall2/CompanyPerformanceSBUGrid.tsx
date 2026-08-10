import React, { useState, useEffect, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { ColDef, ColGroupDef, ICellRendererParams } from 'ag-grid-community';
import { CustomMultiSelect } from '@/@/components/ui/industrialmultiselect';
import MarketShareGridWithHeatmap from "./IndustrialPerformance/charts/marketshareheatmapwithgrid";
import { apiClient } from "@/services/apiClient";

interface GridLevel {
  level: string;
  data: any[];
  filters: Array<{ key: string; cond: string; value: string }>;
}

const DrillDownGrid = () => {
  const [selectedCompanies, setSelectedCompanies] = useState(['HPCL', 'BPCL', 'IOCL']);
  const [gridLevels, setGridLevels] = useState<GridLevel[]>([
    { level: 'sbu_name', data: [], filters: [] }
  ]);
  const [loading, setLoading] = useState(false);
  
  // Add refs for each potential level
  const gridRefs = useRef<{[key: string]: React.RefObject<HTMLDivElement>}>({
    'sbu_name': React.createRef<HTMLDivElement>(),
    'zone_name': React.createRef<HTMLDivElement>(),
    'statename': React.createRef<HTMLDivElement>(),
    'distname': React.createRef<HTMLDivElement>()
  });

  const companies = [
    { id: 'BPCL', name: 'BPCL', disabled: false },
    { id: 'HPCL', name: 'HPCL', disabled: true },
    { id: 'IOCL', name: 'IOCL', disabled: false },
    { id: 'ONGC', name: 'OGC', disabled: false },
    { id: 'RIL', name: 'RIL', disabled: false },
    { id: 'OIL', name: 'OIL', disabled: false },
    { id: 'GAIL', name: 'GAIL', disabled: false },
    { id: 'MARKET', name: 'MARKET', disabled: false }
  ];

  // Map level keys to display titles
  const levelTitleMap: { [key: string]: string } = {
    'sbu_name': 'SBU LEVEL ANALYSIS',
    'zone_name': 'ZONE LEVEL ANALYSIS',
    'statename': 'STATE LEVEL ANALYSIS',
    'distname': 'DISTRICT LEVEL ANALYSIS'
  };

  
  // Map level keys to heatmap titles
  const heatmapTitleMap: { [key: string]: string } = {
    'sbu_name': 'SBU LEVEL MARKET SHARE DISTRIBUTION',
    'zone_name': 'ZONE LEVEL MARKET SHARE DISTRIBUTION',
    'statename': 'STATE LEVEL MARKET SHARE DISTRIBUTION',
    'distname': 'DISTRICT LEVEL MARKET SHARE DISTRIBUTION'
  };
  // Map level keys to stacked chart titles
  const stackedChartTitleMap: { [key: string]: string } = {
    'sbu_name': 'SBU LEVEL MARKET SHARE % AND GROWTH %',
    'zone_name': 'ZONE LEVEL MARKET SHARE % AND GROWTH %',
    'statename': 'STATE LEVEL MARKET SHARE % AND GROWTH %',
    'distname': 'DISTRICT LEVEL MARKET SHARE % AND GROWTH %'
  };

  const drillLevelMap: { [key: string]: string } = {
    'sbu_name': 'zone_name',
    'zone_name': 'statename',
    'statename': 'distname'
  };

  const fetchData = async (level: string, filters: Array<{ key: string; cond: string; value: string }>) => {
    setLoading(true);
    try {
      const baseFilter = { 
        key: '"coname"', 
        cond: "equals", 
        value: selectedCompanies.join(',') 
      };

      const requestBody = {
        filters: [baseFilter, ...filters],
        cross_filters: [],
        action: "industry_performance",
        drill_state: level,
        time_grain: "",
        resp_format: "omc_compare"
      };

      const response = await apiClient.post('/api/charts/generate_vis_data', requestBody);

      if (!response.status) throw new Error('Network response was not ok');
      const data = await response.data;
      return data;
    } catch (error) {
      console.error('Error fetching data:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const updateAllGrids = async () => {
      const updatedLevels = await Promise.all(
        gridLevels.map(async (level) => ({
          ...level,
          data: await fetchData(level.level, level.filters)
        }))
      );
      setGridLevels(updatedLevels);
    };
    updateAllGrids();
  }, [selectedCompanies]);

  const handleDrillDown = async (value: string, currentLevel: string, event?: React.MouseEvent) => {
    // Prevent default behavior if event is provided
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // Don't drill down for "Total" row in any level
    if (value === "Total") {
      return;
    }
    
    const nextLevel = drillLevelMap[currentLevel];
    if (!nextLevel) return;

    const newFilter = {
      key: `"${currentLevel}"`,
      cond: "equals",
      value: value
    };

    const existingLevelIndex = gridLevels.findIndex(level => level.level === nextLevel);
    if (existingLevelIndex !== -1) {
      // Remove levels after the existing level
      const newLevels = gridLevels.slice(0, existingLevelIndex + 1);
      
      // Update the filters for this level
      const currentLevelIndex = gridLevels.findIndex(level => level.level === currentLevel);
      const previousFilters = gridLevels[currentLevelIndex].filters;
      newLevels[existingLevelIndex] = {
        ...newLevels[existingLevelIndex],
        filters: [...previousFilters, newFilter]
      };
      
      setGridLevels(newLevels);
      
      // Fetch new data for this level with updated filters
      const newData = await fetchData(nextLevel, [...previousFilters, newFilter]);
      setGridLevels(prevLevels => {
        const updatedLevels = [...prevLevels];
        updatedLevels[existingLevelIndex] = {
          ...updatedLevels[existingLevelIndex],
          data: newData
        };
        return updatedLevels;
      });
      
      // Scroll to the level after state update
      setTimeout(() => {
        if (gridRefs.current[nextLevel]?.current) {
          // Use scrollIntoView with specific options to prevent page jumping
          gridRefs.current[nextLevel].current?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest'  // Changed from 'start' to 'nearest'
          });
        }
      }, 100);
    } else {
      const currentLevelIndex = gridLevels.findIndex(level => level.level === currentLevel);
      const previousFilters = gridLevels[currentLevelIndex].filters;
      
      const newLevelData = await fetchData(nextLevel, [...previousFilters, newFilter]);
      
      // Set state with new level
      setGridLevels(prevLevels => [
        ...prevLevels,
        {
          level: nextLevel,
          data: newLevelData,
          filters: [...previousFilters, newFilter]
        }
      ]);

      // After setting the state, scroll to the newly added grid - with a slight delay to ensure DOM update
      setTimeout(() => {
        if (gridRefs.current[nextLevel]?.current) {
          // Use scrollIntoView with specific options to prevent page jumping
          gridRefs.current[nextLevel].current?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest'  // Changed from 'start' to 'nearest'
          });
        }
      }, 100);
    }
  };

  const handleCompanySelection = (values: string[]) => {
    if (!values.includes('HPCL')) values.push('HPCL');
    setSelectedCompanies(values);
  };

  const formatValue = (value: any, metric: string): string => {
    if (value === undefined || value === null) return '';
    
    if (metric === "Growth") {
      return typeof value === 'number' ? `${value.toFixed(1)}%` : '';
    }
    
    else if (metric === "Market Share") {
      return typeof value === 'number' ? `${value.toFixed(2)}%` : '';
    }
    return typeof value === 'number' ? value.toLocaleString() : '';
  };

  const generateCompanyColumns = (metric: string): ColDef[] => {
    return selectedCompanies.map((company): ColDef => ({
      headerName: company,
      field: `${metric}.${company}`,
      width: 150,
      valueFormatter: (params) => formatValue(params.value, metric),
      cellClass: (params) => {
        const baseClasses = "text-xs"; // Added text-xs class for smaller font
        if (metric === "Growth" && params.value !== undefined && params.value !== null) {
          return `${baseClasses} ${parseFloat(params.value) >= 0 ? "text-green-500" : "text-red-500"}`;
        }
        return baseClasses;
      }
    }));
  };

  const DrillDownCellRenderer = (props: ICellRendererParams & { level: string }) => {
    // Check if this is the Total row in any level
    if (props.value === "Total") {
      return <span className="text-xs font-medium">Total</span>;
    }
    
    // Check if this is Aviation or NG - these should not be clickable
    if (props.value === "AVIATION" || props.value === "NG") {
      return <span className="text-xs font-medium">{props.value}</span>;
    }
    
    
    return (
      <button 
        onClick={(e) => handleDrillDown(props.value, props.level, e)}
        className="text-blue-600 hover:text-blue-800 font-medium text-xs"
      >
        {props.value || ''}
      </button>
    );
  };

  const getColumnDefs = (level: string): (ColDef | ColGroupDef)[] => [
    {
      headerName: level.replace(/_/g, ' ').toUpperCase(),
      field: level,
      width: 150,
      pinned: 'left' as const,
      cellRenderer: (params: ICellRendererParams) => (
        <DrillDownCellRenderer {...params} level={level} />
      ),
      headerClass: "text-xs", // Added text-xs class for header
    },
    {
      headerName: "Sales",
      children: generateCompanyColumns("Sales"),
      headerClass: "text-xs" // Added text-xs class for header
    },
    {
      headerName: "History",
      children: generateCompanyColumns("History"),
      headerClass: "text-xs" // Added text-xs class for header
    },
    {
      headerName: "Growth",
      children: generateCompanyColumns("Growth"),
      headerClass: "text-xs" ,// Added text-xs class for header
      valueFormatter: params => params.value?.toFixed(1),

    },
    {
      headerName: "Market Share",
      children: generateCompanyColumns("Market Share"),
      headerClass: "text-xs" // Added text-xs class for header
    }
  ];

  // Generate formatted title based on filters
  const formatFilterInfo = (filters: Array<{ key: string; cond: string; value: string }>) => {
    if (filters.length === 0) return '';
    
    // Extract just the values from the filters
    const filterValues = filters.map(f => f.value);
    // Join with slashes
    return ` @ ${filterValues.join('/')}`;
  };

  const handleReset = () => {
    setGridLevels([{ level: 'sbu_name', data: [], filters: [] }]);
  };

  // Process data to ensure Total row is properly labeled
  const processGridData = (data: any[], level: string) => {
    if (!data || data.length === 0) return [];
    
    return data.map(row => {
      // If the row has a null or undefined value for the level field, set it to "Total"
      if (row[level] === null || row[level] === undefined || row[level] === "") {
        return {
          ...row,
          [level]: "Total"
        };
      }
      return row;
    });
  };

  return (
    <div className="space-y-2 pb-0 mb-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <span className="text-xs font-medium ml-2">Select Company:</span>
          <CustomMultiSelect
            options={companies}
            defaultValue={['HPCL', 'IOCL', 'BPCL']}
            onValueChange={handleCompanySelection}
            placeholder="Select Companies"
            className="w-[300px] h-8 text-xs"
            value={selectedCompanies}
          />
        </div>
      </div>

      {gridLevels.map((gridLevel, index) => (
        <div 
          key={gridLevel.level} 
          ref={gridRefs.current[gridLevel.level]}
          className={`${index === gridLevels.length - 1 ? 'mb-0 pb-0' : ''}`}
        >
          <MarketShareGridWithHeatmap
            level={gridLevel.level}
            data={processGridData(gridLevel.data, gridLevel.level)}
            companies={selectedCompanies}
            columnDefs={getColumnDefs(gridLevel.level)}
            gridTitle={levelTitleMap[gridLevel.level] + formatFilterInfo(gridLevel.filters)}
            heatmapTitle={heatmapTitleMap[gridLevel.level] + formatFilterInfo(gridLevel.filters)}
            stackedChartTitle={stackedChartTitleMap[gridLevel.level] + formatFilterInfo(gridLevel.filters)}
            filterInfo=""
          />
        </div>
      ))}
    </div>
  );
};

export default DrillDownGrid;