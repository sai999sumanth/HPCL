import React, { useEffect, useRef, useState } from 'react';

import { apiClient } from "@/services/apiClient";
import { Loader2, ChevronUp, ChevronDown, Plus, Minus, ChevronRight, X, FilterX } from 'lucide-react';

// Default data structure (will be replaced by API data)
const defaultData = [];

const getColorForScore = (score: number) => {
  // Score is already normalized to 0-100 scale
  if (score >= 95) return { light: "#5CB338", lighter: "#7dd84a" }; // Green for 95-100%
  if (score >= 80) return { light: "#eab308", lighter: "#fde047" }; // Yellow for 80-94%
  return { light: "#dc2626", lighter: "#ef4444" }; // Red for <80%
};

/** Solid fill color by %: 0–30 red, 31–60 amber, 61–100 green (no gradient). */
const getBarFillColor = (pct: number): string => {
  const v = Math.min(100, Math.max(0, pct));
  if (v <= 30) return '#dc2626';   // red
  if (v <= 60) return '#f59e0b';   // amber
  return '#22c55e';                // green
};

/** Circle uses same color as bar: red / amber / green background and border; white text for contrast; 0 = grey. */
const getWeightageCircleStyle = (pct: number): React.CSSProperties => {
  const v = Math.min(100, Math.max(0, pct));
  if (v <= 0) return { background: '#f1f5f9', border: '2px solid #94a3b8', color: '#64748b' };
  const barColor = getBarFillColor(pct);
  return { background: barColor, border: `3px solid ${barColor}`, color: '#ffffff' };
};

interface PerformanceScoreCardProps {
  startDate?: string;
  endDate?: string;
  refreshTrigger?: number;
  selectedZone?: string | null;
  onClearZoneFilter?: () => void;
  onLocationSelect?: (locationName: string, zone: string) => void;
  onFirstLocationLoaded?: (locationName: string, zone: string) => void;
  onViewModeChange?: (viewMode: 'location' | 'zone') => void;
}

const PerformanceScoreCard: React.FC<PerformanceScoreCardProps> = ({ startDate, endDate, refreshTrigger = 0, selectedZone = null, onClearZoneFilter, onLocationSelect, onFirstLocationLoaded, onViewModeChange }) => {
  const [performanceData, setPerformanceData] = useState(defaultData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [hasNotifiedFirstLocation, setHasNotifiedFirstLocation] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [closeButtonLeft, setCloseButtonLeft] = useState(0);
  const [selectedLocationData, setSelectedLocationData] = useState<any>(null);
  const [tasCategoryData, setTasCategoryData] = useState<any>(null);
  const [isLoadingTasData, setIsLoadingTasData] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set());
  const [sortColumn, setSortColumn] = useState<{ [key: number]: string | null }>({});
  const [sortDirection, setSortDirection] = useState<{ [key: number]: 'asc' | 'desc' | null }>({});
  
  // Main table sorting state
  const [mainSortColumn, setMainSortColumn] = useState<string | null>(null);
  const [mainSortDirection, setMainSortDirection] = useState<'asc' | 'desc' | null>(null);

  // Sheet: refs to scroll module row into view when expanding nested (keep main parameter row visible)
  const sheetModuleRowRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const scrollToModuleAfterExpand = useRef<number | null>(null);
  
  // Force re-render when selectedZone changes
  const [, forceUpdate] = useState({});

  // Handle sorting for main table
  const handleMainSort = (column: string) => {
    if (mainSortColumn === column) {
      if (mainSortDirection === 'asc') {
        setMainSortDirection('desc');
      } else if (mainSortDirection === 'desc') {
        setMainSortColumn(null);
        setMainSortDirection(null);
      }
    } else {
      setMainSortColumn(column);
      setMainSortDirection('asc');
    }
  };

  // Handle sorting for nested tables
  const handleSort = (categoryIndex: number, column: string) => {
    const currentSort = sortColumn[categoryIndex];
    const currentDirection = sortDirection[categoryIndex];
    
    if (currentSort === column) {
      if (currentDirection === 'asc') {
        setSortDirection({ ...sortDirection, [categoryIndex]: 'desc' });
      } else if (currentDirection === 'desc') {
        setSortColumn({ ...sortColumn, [categoryIndex]: null });
        setSortDirection({ ...sortDirection, [categoryIndex]: null });
      }
    } else {
      setSortColumn({ ...sortColumn, [categoryIndex]: column });
      setSortDirection({ ...sortDirection, [categoryIndex]: 'asc' });
    }
  };

  // Get sorted nested results
  const getSortedNestedResults = (categoryIndex: number, results: any[]) => {
    const sortCol = sortColumn[categoryIndex];
    const sortDir = sortDirection[categoryIndex];
    
    if (!sortCol || !sortDir) {
      return results;
    }
    
    return [...results].sort((a: any, b: any) => {
      let aVal = a[sortCol];
      let bVal = b[sortCol];
      
      if (sortCol === 'name' || sortCol === 'module') {
        aVal = (aVal || '').toString().toLowerCase();
        bVal = (bVal || '').toString().toLowerCase();
        return sortDir === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      } else {
        aVal = aVal !== undefined && aVal !== null ? Number(aVal) : 0;
        bVal = bVal !== undefined && bVal !== null ? Number(bVal) : 0;
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });
  };

  // Force re-render when selectedZone prop changes
  useEffect(() => {
    forceUpdate({});
  }, [selectedZone]);

  // Auto-expand all modules when TAS data loads
  useEffect(() => {
    if (tasCategoryData?.results && tasCategoryData.results.length > 0) {
      const allIndices = new Set<number>();
      tasCategoryData.results.forEach((_: any, index: number) => {
        allIndices.add(index);
      });
      setExpandedModules(allIndices);
    }
  }, [tasCategoryData]);

  // When a module is expanded, scroll its row into view so the main parameter row doesn’t scroll away
  useEffect(() => {
    if (scrollToModuleAfterExpand.current === null) return;
    const idx = scrollToModuleAfterExpand.current;
    scrollToModuleAfterExpand.current = null;
    const el = sheetModuleRowRefs.current[idx];
    if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [expandedModules]);

  // Toggle module expand/collapse
  const toggleModule = (moduleIndex: number) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleIndex)) {
      newExpanded.delete(moduleIndex);
    } else {
      newExpanded.add(moduleIndex);
      scrollToModuleAfterExpand.current = moduleIndex; // scroll main row into view after expand
    }
    setExpandedModules(newExpanded);
  };

  // // Calculate weighted score
  // const calculateWeightedScore = (score: number, weightage: number) => {
  //   return ((score * weightage) / 100).toFixed(2);
  // };

  // Get status based on score percentage
  const getStatus = (score: number, weightage: number) => {
    const percentage = weightage > 0 ? (score / weightage) * 100 : 0;
    if (percentage >= 95) return { 
      label: 'Good', 
      color: 'bg-green-100 text-green-800 border-green-200',
      scoreColor: 'text-green-600'
    };
    if (percentage >= 80) return { 
      label: 'Fair', 
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      scoreColor: 'text-yellow-600'
    };
    return { 
      label: 'Critical', 
      color: 'bg-red-100 text-red-800 border-red-200',
      scoreColor: 'text-red-600'
    };
  };

  // Calculate TAS average overall score
  const calculateTasAverage = () => {
    if (performanceData.length === 0) return 0;
    const totalScore = performanceData.reduce((sum, item) => sum + (item.score || 0), 0);
    return Math.round((totalScore / performanceData.length) * 100) / 100;
  };

  const tasAverageScore = calculateTasAverage();

  // Filter and sort data based on selected zone (from Zone card) and search term (location view only)
  const getFilteredAndSortedData = () => {
    let data = performanceData;
    // When a zone is selected in the Zone card, show only locations belonging to that zone
    if (selectedZone) {
      data = data.filter((item) => (item.zone || '') === selectedZone);
    }
    data = data.filter(
      (item) =>
        item.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.zone.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Apply sorting
    if (mainSortColumn && mainSortDirection) {
      data = [...data].sort((a: any, b: any) => {
        let aVal = a[mainSortColumn];
        let bVal = b[mainSortColumn];
        
        // Handle location/zone (string) sorting
        if (mainSortColumn === 'location' || mainSortColumn === 'zone') {
          aVal = (aVal || '').toString().toLowerCase();
          bVal = (bVal || '').toString().toLowerCase();
          return mainSortDirection === 'asc' 
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        } else {
          // Handle numeric sorting (rank, score)
          aVal = aVal !== undefined && aVal !== null ? Number(aVal) : 0;
          bVal = bVal !== undefined && bVal !== null ? Number(bVal) : 0;
          return mainSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
      });
    }
    
    return data;
  };
  
  const filteredData = getFilteredAndSortedData();

  useEffect(() => {
    const fetchPerformanceData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Use provided dates or default to today
        const defaultStartDate = startDate || new Date().toISOString().split('T')[0];
        const defaultEndDate = endDate || new Date().toISOString().split('T')[0];

        const payload = {
          "bu": "TAS",
          "category": "",
          "region": "",
          "zone": "",
          "sap_id": "",
          "strategy": "",
          "filters": [
            {
              "key": "created_at",
              "cond": "date_filter",
              "value": `${defaultStartDate},${defaultEndDate}`,
              "val": ""
            }
          ],
          "is_plant": true
        };

        const response = await apiClient.post('/api/performanceindex/get_pi_score', payload);

        // Transform API response to match our data structure
        if (response && response.data) {
          const apiData = response.data;

          // Handle different response structures
          let dataArray = [];
          if (Array.isArray(apiData)) {
            dataArray = apiData;
          } else if (typeof apiData === 'object' && apiData !== null) {
            // The API returns an object with SAP IDs as keys, convert to array of values
            dataArray = Object.values(apiData);
          }

          // Always update the state - even with empty array to clear old data
          if (dataArray.length > 0) {
            // Transform data first
            const transformedData = dataArray.map((item: any, index: number) => {
              // Find TAS category and use its score directly
              const tasCategory = item.category?.find((cat: any) => cat.name === 'TAS');
              let tasScore = 0;
              let tasWeightage = 20; // Default TAS weightage
              
              if (tasCategory && tasCategory.score !== undefined) {
                // Use TAS score directly (e.g., 20)
                tasScore = tasCategory.score;
                tasWeightage = tasCategory.weightage || 20;
              } else {
                // Fallback to overall_oi_score
                tasScore = item.overall_oi_score || item.score || 0;
              }
              
              // Normalize score to 100 scale: (score / weightage) * 100
              const normalizedScore = tasWeightage > 0 ? (tasScore / tasWeightage) * 100 : 0;
              
              return {
                location: item.name || item.location || `Location ${index + 1}`,
                zone: item.zone || '',
                score: Math.round(normalizedScore * 100) / 100, // Normalized score (0-100) for display
                cells: item.category ? item.category.length : Math.floor(Math.random() * 12) + 1,
                sap_id: item.sap_id || '', // Store sap_id for API calls
                fullData: item // Store full item data
              };
            });

            // Sort by score descending (highest score first = best performance)
            const sortedData = transformedData.sort((a: any, b: any) => b.score - a.score);

            // Don't show locations where TAS score is 0
            const sortedNonZero = sortedData.filter((item) => (item.score ?? 0) > 0);

            // Assign ranks based on sorted order, with ties getting same rank (dense ranking)
            let currentRank = 1;
            const rankedData = sortedNonZero.map((item: any, index: number) => {
              // If not first item and score differs from previous, increment rank by 1
              if (index > 0 && item.score !== sortedNonZero[index - 1].score) {
                currentRank++;
              }
              return {
                ...item,
                rank: currentRank
              };
            });

            setPerformanceData(rankedData);
            
            // Notify parent about first location for default chart display (only once)
            if (rankedData.length > 0 && onFirstLocationLoaded && !hasNotifiedFirstLocation) {
              const firstLocation = rankedData[0];
              onFirstLocationLoaded(firstLocation.location, firstLocation.zone);
              setHasNotifiedFirstLocation(true);
            }
          } else {
            // Clear data if no results
            setPerformanceData([]);
          }
        }
      } catch (err: any) {
        console.error('Failed to fetch performance data:', err);
        setError(err?.response?.data?.message || err.message || 'Failed to load data');
        // Keep mock data as fallback
      } finally {
        setIsLoading(false);
      }
    };

    fetchPerformanceData();
  }, [startDate, endDate, refreshTrigger]);

  // Reset notification flag when refresh trigger changes
  useEffect(() => {
    setHasNotifiedFirstLocation(false);
    setSearchTerm(''); // Reset search to default
    setMainSortColumn(null); // Reset main table sort
    setMainSortDirection(null);
    setExpandedRows(new Set()); // Collapse expanded rows
    setExpandedModules(new Set());
    setIsDialogOpen(false); // Close detail dialog if open
    if (onViewModeChange) {
      onViewModeChange('location');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  // Cancel button position: just outside and near the sheet (sheet width 93%)
  useEffect(() => {
    if (isDialogOpen) {
      const updateButtonPosition = () => {
        const vw = window.innerWidth;
        const sheetWidthPx = vw * 0.93;
        setCloseButtonLeft(Math.max(8, vw - sheetWidthPx - 8));
      };
      updateButtonPosition();
      window.addEventListener('resize', updateButtonPosition);
      const t = setTimeout(updateButtonPosition, 100);
      return () => {
        window.removeEventListener('resize', updateButtonPosition);
        clearTimeout(t);
      };
    }
  }, [isDialogOpen]);

  // Normalize TAS category so it always has .results array (modules) and each module has .results (params)
  const normalizeTasCategory = (cat: any): any => {
    if (!cat || typeof cat !== 'object') return { results: [] };
    const modules = Array.isArray(cat.results) ? cat.results
      : Array.isArray(cat.data) ? cat.data
      : Array.isArray(cat.parameters) ? cat.parameters
      : Array.isArray(cat.modules) ? cat.modules
      : [];
    const normalizedModules = modules.map((mod: any) => {
      const nested = Array.isArray(mod?.results) ? mod.results
        : Array.isArray(mod?.parameters) ? mod.parameters
        : Array.isArray(mod?.data) ? mod.data
        : [];
      const normalizedNested = nested.map((p: any) => ({
        ...p,
        name: p?.name ?? p?.parameter_name ?? p?.parameter ?? 'Parameter',
        score: p?.score,
        weightage: p?.weightage
      }));
      return { ...mod, name: mod?.name ?? mod?.module ?? 'Module', score: mod?.score, weightage: mod?.weightage, results: normalizedNested };
    });
    return { ...cat, results: normalizedModules };
  };

  // Function to fetch TAS data for a specific location
  const fetchTasDataForLocation = async (item: any) => {
    try {
      setIsLoadingTasData(true);
      setError(null);

      // First, try to use existing data if available
      if (item.fullData) {
        const tasCategory = item.fullData.category?.find((cat: any) => cat.name === 'TAS');
        if (tasCategory) {
          setTasCategoryData(normalizeTasCategory(tasCategory));
          setSelectedLocationData(item.fullData);
          setExpandedRows(new Set());
          setIsDialogOpen(true);
          setIsLoadingTasData(false);
          return;
        }
      }

      // If no existing data, make API call
      // Use provided dates or default to today
      const defaultStartDate = startDate || new Date().toISOString().split('T')[0];
      const defaultEndDate = endDate || new Date().toISOString().split('T')[0];

      const payload = {
        "bu": "TAS",
        "category": "",
        "region": "",
        "zone": item.zone || "",
        "sap_id": item.sap_id || "",
        "strategy": "",
        "filters": [
          {
            "key": "created_at",
            "cond": "date_filter",
            "value": `${defaultStartDate},${defaultEndDate}`,
            "val": ""
          }
        ],
        "is_plant": true
      };

      const response = await apiClient.post('/api/performanceindex/get_pi_score', payload);

      if (response && response.data) {
        const apiData = response.data;
        let dataArray = [];
        
        if (Array.isArray(apiData)) {
          dataArray = apiData;
        } else if (typeof apiData === 'object' && apiData !== null) {
          dataArray = Object.values(apiData);
        }

        // Find the specific location data
        const locationData = dataArray.find((data: any) => 
          (data.sap_id && data.sap_id === item.sap_id) || 
          (data.name && data.name === item.location)
        );

        if (locationData) {
          const tasCategory = locationData.category?.find((cat: any) => cat.name === 'TAS');
          if (tasCategory) {
            setTasCategoryData(normalizeTasCategory(tasCategory));
            setSelectedLocationData(locationData);
            setExpandedRows(new Set());
            setIsDialogOpen(true);
          } else {
            setTasCategoryData({ results: [] });
            setSelectedLocationData(locationData);
            setIsDialogOpen(true);
          }
        } else {
          setTasCategoryData({ results: [] });
          setSelectedLocationData({ name: item.location, zone: item.zone });
          setIsDialogOpen(true);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch TAS data:', err);
      setError(err?.response?.data?.message || err.message || 'Failed to load TAS data');
    } finally {
      setIsLoadingTasData(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">TAS Score</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Loading performance data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex flex-col">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">TAS Score</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-red-500">data unavailable </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* Header with Search in Same Row */}
      <div className="flex items-center justify-between pb-1.5 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-semibold text-gray-900">
            TAS Score
            {tasAverageScore > 0 && (
              <span className="ml-2 text-sm font-semibold text-gray-900">
                <span className="text-blue-600 gap-2 ">(TAS avg-{tasAverageScore.toFixed(2)} %){selectedZone}</span>
              </span>
            )}
          </h3>
        </div>

        <div className="flex items-center gap-3">
          {selectedZone && onClearZoneFilter && (
            <button
              type="button"
              onClick={onClearZoneFilter}
              title="Clear zone filter - show all locations"
              className="flex items-center justify-center w-8 h-8 rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors"
            >
              <FilterX className="w-4 h-4" />
            </button>
          )}
          <div className="relative w-40">
          <input
            type="text"
            placeholder="Search locations/zones..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-2 py-1 pl-6 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="absolute inset-y-0 left-0 pl-1.5 flex items-center pointer-events-none">
            <svg className="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0">
        <table className="w-full border-collapse table-auto ">
          <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b-2 border-gray-200">
                  <th
                    className="text-left py-1.5 pr-2 pl-2 font-semibold text-xs text-gray-700 w-auto cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleMainSort('location')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Location</span>
                      <span className="inline-flex flex-col -space-y-1">
                        <ChevronUp className={`w-3 h-3 ${mainSortColumn === 'location' && mainSortDirection === 'asc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                        <ChevronDown className={`w-3 h-3 ${mainSortColumn === 'location' && mainSortDirection === 'desc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                      </span>
                    </div>
                  </th>
                  <th 
                    className="text-left py-1 pr-4 pl-4 font-semibold text-xs text-gray-700 w-auto cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleMainSort('zone')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Zone</span>
                      <span className="inline-flex flex-col -space-y-1">
                        <ChevronUp className={`w-3 h-3 ${mainSortColumn === 'zone' && mainSortDirection === 'asc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                        <ChevronDown className={`w-3 h-3 ${mainSortColumn === 'zone' && mainSortDirection === 'desc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                      </span>
                    </div>
                  </th>
                  <th 
                    className="text-left py-1.5 px-2 font-semibold text-xs text-gray-700 w-auto cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleMainSort('rank')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Rank</span>
                      <span className="inline-flex flex-col -space-y-1">
                        <ChevronUp className={`w-3 h-3 ${mainSortColumn === 'rank' && mainSortDirection === 'asc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                        <ChevronDown className={`w-3 h-3 ${mainSortColumn === 'rank' && mainSortDirection === 'desc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                      </span>
                    </div>
                  </th>
                  <th 
                    className="text-center py-1 px-2 font-semibold text-xs text-gray-700 whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleMainSort('score')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>TAS Score (%)</span>
                      <span className="inline-flex flex-col -space-y-1">
                        <ChevronUp className={`w-3 h-3 ${mainSortColumn === 'score' && mainSortDirection === 'asc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                        <ChevronDown className={`w-3 h-3 ${mainSortColumn === 'score' && mainSortDirection === 'desc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                      </span>
                    </div>
                  </th>
              <th className="text-left py-1 px-2 font-semibold text-xs text-gray-700 w-auto"></th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, index) => (
                  <tr
                    key={index}
                    className="border-b border-gray-100 cursor-pointer hover:bg-gray-50"
                    onClick={() => {
                      if (onLocationSelect) {
                        onLocationSelect(item.location, item.zone);
                        setTimeout(() => {
                          const chartElement = document.getElementById('performance-score-breakdown-chart');
                          if (chartElement) {
                            chartElement.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
                          }
                        }, 100);
                      }
                    }}
                  >
                    <td className="py-1.5 pr-2 pl-2 text-xs font-medium text-blue-600 whitespace-nowrap hover:text-blue-700">{item.location}</td>
                <td className="py-1.5 pr-4 pl-4 text-xs text-gray-900 whitespace-nowrap">{item.zone}</td>
                <td className="py-1.5 px-2 text-xs font-semibold text-gray-900 whitespace-nowrap">
                  {(item.score ?? 0) === 0 ? '-' : item.rank}
                </td>
                <td className="py-1 px-2 text-center">
                  {(item.score ?? 0) === 0 ? (
                    <span
                      className="text-xs text-red-600 inline-block"
                      title="TAS not integrated with Novex"
                    >
                      -----
                    </span>
                  ) : (
                  <div className="flex items-center justify-center gap-2 w-full">
                    <div className="tas-gov-score-bar-track flex-1 bg-gray-300 rounded-full h-5 relative min-w-0">
                      <div
                        className="h-full rounded-full flex items-center transition-all duration-300"
                        style={{
                              width: `${Math.max(item.score || 0, 0)}%`,
                              minWidth: (item.score || 0) > 0 ? '55px' : '0px',
                              background: `linear-gradient(to right, ${getColorForScore(item.score || 0).lighter}, ${getColorForScore(item.score || 0).light})`,
                              justifyContent: (item.score || 0) < 30 ? 'flex-start' : 'flex-end',
                              paddingLeft: (item.score || 0) < 30 ? '6px' : '0',
                              paddingRight: (item.score || 0) >= 30 ? '6px' : '0',
                              overflow: 'visible',
                            }}
                          >
                            <span className="text-xs font-semibold text-white whitespace-nowrap">{item.score.toFixed(2)}%</span>
                          </div>
                        </div>
                  </div>
                  )}
                </td>
                <td className="py-1.5 px-2">
                  <button
                    className="w-4 h-4 rounded-full bg-white border border-blue-200 flex items-center justify-center text-blue-600 hover:text-blue-700 hover:border-blue-300 text-[10px] font-semibold transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      fetchTasDataForLocation(item);
                    }}
                    title="More information"
                  >
                    i
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sticky Legend at Bottom */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 py-2 px-2 flex-shrink-0">
        <div className="flex gap-3 items-center text-xs justify-center flex-wrap">
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className="w-3 h-3 rounded flex-shrink-0" style={{ background: 'linear-gradient(to right,rgb(93, 202, 46), #5CB338)' }}></div>
            <span className="text-gray-600 whitespace-nowrap text-xs">Excellent (95-100%)</span>
        </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className="w-3 h-3 rounded flex-shrink-0" style={{ background: 'linear-gradient(to right,rgb(235, 189, 39), #eab308)' }}></div>
            <span className="text-gray-600 whitespace-nowrap text-xs">Good (80-94%)</span>
        </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className="w-3 h-3 rounded flex-shrink-0" style={{ background: 'linear-gradient(to right,rgb(208, 49, 49), #dc2626)' }}></div>
            <span className="text-gray-600 whitespace-nowrap text-xs">Needs Improvement (&lt;80%)</span>
            </div>
        </div>
      </div>

      {/* TAS Details – sliding sheet from right, same width & cancel outside as LocationDetailDialog */}
      {isDialogOpen && (
        <>
          <style>{`@keyframes tasSheetSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
          {/* Cancel button outside and near the sheet (same as LocationDetailDialog) */}
          <button
            onClick={() => setIsDialogOpen(false)}
            aria-label="Close"
            className="fixed z-[9999] flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-md transition-colors hover:bg-gray-100"
            style={{
              left: `${closeButtonLeft}px`,
              top: '24px',
              width: '36px',
              height: '36px',
            }}
          >
            <X className="w-5 h-5" />
          </button>
          <div className="fixed inset-0 bg-black/50 flex justify-end z-50 transition-opacity duration-200" onClick={() => setIsDialogOpen(false)}>
            <div
              className="bg-white w-[89vw] h-full flex flex-col shadow-2xl"
              style={{ animation: 'tasSheetSlideIn 0.3s ease-out forwards' }}
              onClick={(e) => e.stopPropagation()}
            >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">
                TAS Details for {selectedLocationData?.name || 'Location'}
              </h3>
              {tasCategoryData?.results && tasCategoryData.results.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedModules(new Set(tasCategoryData.results.map((_: any, i: number) => i)))}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    Expand All
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedModules(new Set())}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    Collapse All
                  </button>
                </div>
              )}
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {isLoadingTasData ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-sm text-gray-600">Loading TAS data...</span>
                </div>
              ) : tasCategoryData ? (
                <div className="flex-1 flex flex-col pt-2 px-6 pb-6 overflow-hidden min-h-0">
                  {/* ScoreVisualization-style: Parameter | Score % | Weightage vs Score Visualization | Weightage (real data) */}
                  {(!tasCategoryData.results || tasCategoryData.results.length === 0) ? (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-sm text-gray-500">No TAS data available for this location</p>
                                            </div>
                                          ) : (
                    <div className="flex-1 min-h-0 flex flex-col w-full max-w-full rounded-xl border border-gray-200 bg-white shadow-md overflow-hidden">
                      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                        {/* Sticky header - grid 2fr 1fr 3fr 1fr */}
                        <div className="sticky top-0 z-10 grid grid-cols-[2fr_1fr_3fr_1fr] gap-2 sm:gap-4 px-3 sm:px-4 py-4 border-b border-gray-200 bg-[#f8f9fa] text-xs font-bold text-black uppercase tracking-wide shadow-sm flex-shrink-0">
                          <div>Parameter</div>
                          <div className="text-center">Score</div>
                          <div className="text-center">Weightage vs Score Visualization</div>
                          <div className="text-right">Weightage</div>
                                          </div>
                        {/* Scrollable body - categories and nested rows */}
                        <div className="flex-1 min-h-0 overflow-y-auto">
                        {/* Categories - real data from tasCategoryData.results */}
                        {tasCategoryData.results.map((module: any, moduleIdx: number) => {
                          const hasNested = module.results && module.results.length > 0;
                          const isExpanded = expandedModules.has(moduleIdx);
                          const mScore = Number(module.score) ?? 0;
                          const mWeight = Number(module.weightage) ?? 100;
                          const mPct = mWeight > 0 ? Math.min(100, (mScore / mWeight) * 100) : 0;
                          const scoreColor = mPct >= 80 ? 'green' : mPct > 0 ? 'red' : 'grey';
                          const textColor = scoreColor === 'green' ? '#22c55e' : scoreColor === 'red' ? '#ef4444' : '#94a3b8';
                          const weightageCircleStyle = getWeightageCircleStyle(mPct);
                          const weightageScore = `${mScore.toFixed(2)} / ${mWeight.toFixed(2)}`;
                          const barPct = mWeight > 0 ? (mScore / mWeight) * 100 : 0;
                          return (
                            <React.Fragment key={moduleIdx}>
                              {hasNested && isExpanded ? (
                                <div className="flex flex-col border-b border-gray-200 min-w-0">
                                  {/* Sticky module header (e.g. Safety_Interlocks) - stays visible when scrolling nested content */}
                                  <div
                                    ref={(el) => { sheetModuleRowRefs.current[moduleIdx] = el; }}
                                    className="sticky top-0 z-10 grid grid-cols-[2fr_1fr_3fr_1fr] gap-2 sm:gap-4 px-3 sm:px-4 py-2.5 items-center border-b border-gray-200 bg-white cursor-pointer hover:bg-[#f8f9fa] transition-colors min-w-0 shadow-sm"
                                    onClick={() => toggleModule(moduleIdx)}
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <ChevronUp className="w-2.5 h-2.5 text-gray-500 flex-shrink-0" />
                                      <span className="text-xs font-semibold text-black truncate">{module.name || 'Module'}</span>
                                      </div>
                                    <div className="flex justify-center items-center">
                                      <span className="text-sm font-semibold text-center" style={{ color: textColor }}>
                                        {module.score !== undefined && module.score !== null ? (Number(module.score) % 1 === 0 ? Number(module.score) : Number(module.score).toFixed(2)) : '-'}
                                      </span>
                                    </div>
                                    <div className="flex flex-col gap-1 min-w-0 items-center justify-center">
                                      <div className="w-full max-w-[220px] flex flex-col items-center gap-0.5">
                                        <span className="text-xs font-bold text-black text-center">{mPct.toFixed(1)}%</span>
                                        <div className="w-full h-6 relative overflow-hidden">
                                          <div className="absolute inset-0 h-6 bg-gray-300 rounded-full overflow-hidden">
                                            {barPct > 0 && (
                                              <div className="h-full rounded-full absolute left-0 top-0 bottom-0 transition-all duration-500" style={{ width: `${Math.min(100, barPct)}%`, minWidth: '4px', background: getBarFillColor(barPct) }} />
                                            )}
                                          </div>
                                        </div>
                                        <span className="text-xs font-bold" style={{ color: textColor }}>{weightageScore}</span>
                                      </div>
                                    </div>
                                    <div className="flex justify-center">
                                      <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm ring-2 ring-white ring-offset-1" style={weightageCircleStyle}>
                                        {module.weightage != null ? (Number(module.weightage) % 1 === 0 ? Number(module.weightage) : Number(module.weightage).toFixed(2)) : '-'}%
                                      </div>
                                    </div>
                                  </div>
                                  {/* Scrollable nested parameters - only this part scrolls, header stays sticky above */}
                                  <div className="max-h-[280px] overflow-y-auto bg-white">
                                  {(module.results || []).map((param: any, paramIdx: number) => {
                                    const pScore = Number(param.score) ?? 0;
                                    const pWeight = Number(param.weightage) ?? 100;
                                    const pPct = pWeight > 0 ? Math.min(100, (pScore / pWeight) * 100) : 0;
                                    const pWeightageCircleStyle = getWeightageCircleStyle(pPct);
                                    const pWeightageStr = param.weightage != null ? (Number(param.weightage) % 1 === 0 ? Number(param.weightage) : Number(param.weightage).toFixed(2)) : '-';
                                    const pScoreMax = `${pScore.toFixed(2)} / ${pWeight.toFixed(2)}`;
                                    return (
                                      <div
                                        key={paramIdx}
                                        className={`grid grid-cols-[2fr_1fr_3fr_1fr] gap-1 sm:gap-2 px-2 sm:px-3 py-1 pl-16 items-center min-w-0 ${paramIdx === 0 ? '' : 'border-t border-gray-200'}`}
                                      >
                                        <div className="text-[11px] text-black truncate">{param.name || 'Parameter'}</div>
                                        <div className="text-[11px] text-black text-center font-medium">{param.score !== undefined && param.score !== null ? (Number(param.score) % 1 === 0 ? Number(param.score) : Number(param.score).toFixed(2)) : '-'}</div>
                                        <div className="min-w-0 flex justify-center">
                                          <div className="w-full max-w-[220px]">
                                            {/* Bar: full gradient clipped to fill % so 0.9% = red only, 98% = red then light→dark */}
                                            <div className="w-full h-4 bg-gray-300 rounded-full overflow-hidden relative">
                                              {pPct > 0 && (
                                                <div className="h-full rounded-full absolute left-0 top-0 bottom-0 transition-all duration-500" style={{ width: `${Math.min(100, pPct)}%`, minWidth: '4px', background: getBarFillColor(pPct) }} />
                                              )}
                                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <span className="text-[9px] font-bold text-black">{pPct.toFixed(1)}%</span>
                                              </div>
                                            </div>
                                            {/* Below bar: score/max only */}
                                            <div className="flex flex-col items-center gap-0 mt-0.5">
                                              <span className="text-[9px] font-bold text-black">{pScoreMax}</span>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex justify-center">
                                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 shadow-sm ring-2 ring-white ring-offset-1" style={pWeightageCircleStyle}>
                                            {pWeightageStr}%
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  </div>
                                </div>
                              ) : (
                                <div
                                  ref={(el) => { sheetModuleRowRefs.current[moduleIdx] = el; }}
                                  className="grid grid-cols-[2fr_1fr_3fr_1fr] gap-2 sm:gap-4 px-3 sm:px-4 py-2.5 items-center border-b border-gray-200 bg-white cursor-pointer hover:bg-[#f8f9fa] transition-colors min-w-0"
                                  onClick={() => hasNested && toggleModule(moduleIdx)}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    {hasNested ? (
                                      <ChevronDown className="w-2.5 h-2.5 text-gray-500 flex-shrink-0" />
                                    ) : (
                                      <span className="w-2.5 flex-shrink-0" />
                                    )}
                                    <span className="text-xs font-semibold text-black truncate">{module.name || 'Module'}</span>
                                  </div>
                                  <div className="flex justify-center items-center">
                                    <span className="text-sm font-semibold text-center" style={{ color: textColor }}>
                                      {module.score !== undefined && module.score !== null ? (Number(module.score) % 1 === 0 ? Number(module.score) : Number(module.score).toFixed(2)) : '-'}
                                    </span>
                                  </div>
                                  <div className="flex flex-col gap-1 min-w-0 items-center justify-center">
                                    <div className="w-full max-w-[220px] flex flex-col items-center gap-0.5">
                                      <span className="text-xs font-bold text-black text-center">{mPct.toFixed(1)}%</span>
                                      <div className="w-full h-6 relative overflow-hidden">
                                        <div className="absolute inset-0 h-6 bg-gray-300 rounded-full overflow-hidden">
                                          {barPct > 0 && (
                                            <div className="h-full rounded-full absolute left-0 top-0 bottom-0 transition-all duration-500" style={{ width: `${Math.min(100, barPct)}%`, minWidth: '4px', background: getBarFillColor(barPct) }} />
                                          )}
                                        </div>
                                      </div>
                                      <span className="text-xs font-bold" style={{ color: textColor }}>{weightageScore}</span>
                                    </div>
                                  </div>
                                  <div className="flex justify-center">
                                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm ring-2 ring-white ring-offset-1" style={weightageCircleStyle}>
                                      {module.weightage != null ? (Number(module.weightage) % 1 === 0 ? Number(module.weightage) : Number(module.weightage).toFixed(2)) : '-'}%
                                    </div>
                                  </div>
                                </div>
                              )}
                                </React.Fragment>
                              );
                            })}
                                </div>
                              </div>
                    </div>
                        )}
                </div>
              ) : (
                <div className="text-center py-12 text-sm text-gray-500">
                  No TAS data available for this location
                </div>
              )}
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
};

export default PerformanceScoreCard;