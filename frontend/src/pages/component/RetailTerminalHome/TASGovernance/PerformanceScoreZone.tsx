import React, { useEffect, useState } from 'react';
import { apiClient } from '@/services/apiClient';
import { Loader2, ChevronUp, ChevronDown, Plus, Minus, X } from 'lucide-react';

const defaultData: any[] = [];

const getColorForScore = (score: number) => {
  if (score >= 95) return { light: '#5CB338', lighter: '#7dd84a' };
  if (score >= 80) return { light: '#eab308', lighter: '#fde047' };
  return { light: '#dc2626', lighter: '#ef4444' };
};

export interface ZoneRowItem {
  zone: string;
  score: number;
  rank: number;
  locationCount: number;
  locations: any[];
}

interface PerformanceScoreZoneProps {
  startDate?: string;
  endDate?: string;
  refreshTrigger?: number;
  onZoneSelect?: (zone: string) => void;
}

const PerformanceScoreZone: React.FC<PerformanceScoreZoneProps> = ({
  startDate,
  endDate,
  refreshTrigger = 0,
  onZoneSelect,
}) => {
  const [performanceData, setPerformanceData] = useState<any[]>(defaultData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [mainSortColumn, setMainSortColumn] = useState<string | null>(null);
  const [mainSortDirection, setMainSortDirection] = useState<'asc' | 'desc' | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [closeButtonLeft, setCloseButtonLeft] = useState(0);
  const [selectedLocationData, setSelectedLocationData] = useState<any>(null);
  const [tasCategoryData, setTasCategoryData] = useState<any>(null);
  const [isLoadingTasData, setIsLoadingTasData] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set());
  const [sortColumn, setSortColumn] = useState<{ [key: number]: string | null }>({});
  const [sortDirection, setSortDirection] = useState<{ [key: number]: 'asc' | 'desc' | null }>({});

  const handleMainSort = (column: string) => {
    if (mainSortColumn === column) {
      if (mainSortDirection === 'asc') setMainSortDirection('desc');
      else if (mainSortDirection === 'desc') {
        setMainSortColumn(null);
        setMainSortDirection(null);
      }
    } else {
      setMainSortColumn(column);
      setMainSortDirection('asc');
    }
  };

  const getSortedNestedResults = (categoryIndex: number, results: any[]) => {
    const sortCol = sortColumn[categoryIndex];
    const sortDir = sortDirection[categoryIndex];
    if (!sortCol || !sortDir) return results;
    return [...results].sort((a: any, b: any) => {
      let aVal = a[sortCol];
      let bVal = b[sortCol];
      if (sortCol === 'name' || sortCol === 'module') {
        aVal = (aVal || '').toString().toLowerCase();
        bVal = (bVal || '').toString().toLowerCase();
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      aVal = aVal !== undefined && aVal !== null ? Number(aVal) : 0;
      bVal = bVal !== undefined && bVal !== null ? Number(bVal) : 0;
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  };

  useEffect(() => {
    if (tasCategoryData?.results && tasCategoryData.results.length > 0) {
      const allIndices = new Set<number>();
      tasCategoryData.results.forEach((_: any, index: number) => allIndices.add(index));
      setExpandedModules(allIndices);
    }
  }, [tasCategoryData]);

  const toggleModule = (moduleIndex: number) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleIndex)) newExpanded.delete(moduleIndex);
    else newExpanded.add(moduleIndex);
    setExpandedModules(newExpanded);
  };

  const calculateWeightedScore = (score: number, weightage: number) =>
    ((score * weightage) / 100).toFixed(2);

  const getStatus = (score: number, weightage: number) => {
    const percentage = weightage > 0 ? (score / weightage) * 100 : 0;
    if (percentage >= 95) return { label: 'Good', color: 'bg-green-100 text-green-800 border-green-200', scoreColor: 'text-green-600' };
    if (percentage >= 80) return { label: 'Fair', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', scoreColor: 'text-yellow-600' };
    return { label: 'Critical', color: 'bg-red-100 text-red-800 border-red-200', scoreColor: 'text-red-600' };
  };

  const calculateZoneAverages = (): ZoneRowItem[] => {
    const zoneGroups: { [key: string]: { totalScore: number; count: number; locations: any[] } } = {};
    performanceData.forEach((item) => {
      if (!zoneGroups[item.zone]) {
        zoneGroups[item.zone] = { totalScore: 0, count: 0, locations: [] };
      }
      zoneGroups[item.zone].totalScore += item.score;
      zoneGroups[item.zone].count += 1;
      zoneGroups[item.zone].locations.push(item);
    });
    const zoneAverages = Object.entries(zoneGroups).map(([zone, data]) => ({
      zone,
      score: Math.round((data.totalScore / data.count) * 100) / 100,
      locationCount: data.count,
      locations: data.locations,
      rank: 0,
    }));
    const sortedZones = zoneAverages.sort((a, b) => b.score - a.score);
    let currentRank = 1;
    return sortedZones.map((z, index) => {
      if (index > 0 && z.score !== sortedZones[index - 1].score) currentRank++;
      return { ...z, rank: currentRank };
    });
  };

  const getFilteredAndSortedData = (): ZoneRowItem[] => {
    let data = calculateZoneAverages().filter((item) =>
      item.zone.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (mainSortColumn && mainSortDirection) {
      data = [...data].sort((a: any, b: any) => {
        let aVal = a[mainSortColumn];
        let bVal = b[mainSortColumn];
        if (mainSortColumn === 'zone') {
          aVal = (aVal || '').toString().toLowerCase();
          bVal = (bVal || '').toString().toLowerCase();
          return mainSortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        aVal = aVal !== undefined && aVal !== null ? Number(aVal) : 0;
        bVal = bVal !== undefined && bVal !== null ? Number(bVal) : 0;
        return mainSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
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
        const defaultStartDate = startDate || new Date().toISOString().split('T')[0];
        const defaultEndDate = endDate || new Date().toISOString().split('T')[0];
        const payload = {
          bu: 'TAS',
          category: '',
          region: '',
          zone: '',
          sap_id: '',
          strategy: '',
          filters: [
            { key: 'created_at', cond: 'date_filter', value: `${defaultStartDate},${defaultEndDate}`, val: '' },
          ],
          is_plant: true,
        };
        const response = await apiClient.post('/api/performanceindex/get_pi_score', payload);
        if (response?.data) {
          let dataArray: any[] = Array.isArray(response.data) ? response.data : Object.values(response.data || {});
          if (dataArray.length > 0) {
            const transformedData = dataArray.map((item: any, index: number) => {
              const tasCategory = item.category?.find((cat: any) => cat.name === 'TAS');
              let tasScore = 0;
              let tasWeightage = 20;
              if (tasCategory?.score !== undefined) {
                tasScore = tasCategory.score;
                tasWeightage = tasCategory.weightage || 20;
              } else {
                tasScore = item.overall_oi_score ?? item.score ?? 0;
              }
              const normalizedScore = tasWeightage > 0 ? (tasScore / tasWeightage) * 100 : 0;
              return {
                location: item.name || item.location || `Location ${index + 1}`,
                zone: item.zone || '',
                score: Math.round(normalizedScore * 100) / 100,
                cells: item.category ? item.category.length : 0,
                sap_id: item.sap_id || '',
                fullData: item,
              };
            });
            const sortedData = transformedData.sort((a: any, b: any) => b.score - a.score);
            let currentRank = 1;
            const rankedData = sortedData.map((item: any, index: number) => {
              if (index > 0 && item.score !== sortedData[index - 1].score) currentRank++;
              return { ...item, rank: currentRank };
            });
            // Don't show zones/locations where TAS score is 0 (zone view aggregates from this list)
            setPerformanceData(rankedData.filter((item) => (item.score ?? 0) > 0));
          } else {
            setPerformanceData([]);
          }
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || err.message || 'Failed to load data');
        setPerformanceData([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPerformanceData();
  }, [startDate, endDate, refreshTrigger]);

  useEffect(() => {
    setSearchTerm('');
    setMainSortColumn(null);
    setMainSortDirection(null);
    setIsDialogOpen(false);
  }, [refreshTrigger]);

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

  const fetchTasDataForLocation = async (item: any) => {
    try {
      setIsLoadingTasData(true);
      setError(null);
      if (item?.fullData) {
        const tasCategory = item.fullData.category?.find((cat: any) => cat.name === 'TAS');
        if (tasCategory) {
          setTasCategoryData(tasCategory);
          setSelectedLocationData(item.fullData);
          setIsDialogOpen(true);
          setIsLoadingTasData(false);
          return;
        }
      }
      const defaultStartDate = startDate || new Date().toISOString().split('T')[0];
      const defaultEndDate = endDate || new Date().toISOString().split('T')[0];
      const payload = {
        bu: 'TAS',
        category: '',
        region: '',
        zone: item?.zone || '',
        sap_id: item?.sap_id || '',
        strategy: '',
        filters: [
          { key: 'created_at', cond: 'date_filter', value: `${defaultStartDate},${defaultEndDate}`, val: '' },
        ],
        is_plant: true,
      };
      const response = await apiClient.post('/api/performanceindex/get_pi_score', payload);
      if (response?.data) {
        let dataArray: any[] = Array.isArray(response.data) ? response.data : Object.values(response.data || {});
        const locationData = dataArray.find(
          (data: any) =>
            (data.sap_id && data.sap_id === item?.sap_id) || (data.name && data.name === item?.location)
        );
        if (locationData) {
          const tasCategory = locationData.category?.find((cat: any) => cat.name === 'TAS');
          if (tasCategory) {
            setTasCategoryData(tasCategory);
            setSelectedLocationData(locationData);
            setIsDialogOpen(true);
          }
        }
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to load data');
    } finally {
      setIsLoadingTasData(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">TAS Score (Zone)</h3>
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
        <h3 className="text-sm font-semibold text-gray-900 mb-3">TAS Score (Zone)</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-red-500">data unavailable</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-white">
      <div className="flex items-center justify-between pb-3 flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-900">TAS Score (Zone)</h3>
        <div className="relative w-40">
          <input
            type="text"
            placeholder="Search zones..."
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

      <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0">
        <table className="w-full border-collapse table-auto">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b-2 border-gray-200">
              <th
                className="text-left py-1 pr-2 pl-2 font-semibold text-xs text-gray-700 w-auto cursor-pointer hover:bg-gray-100 select-none"
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
                className="text-left py-1 px-1.5 font-semibold text-xs text-gray-700 w-auto cursor-pointer hover:bg-gray-100 select-none"
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
                className="text-center py-1 px-1.5 font-semibold text-xs text-gray-700 whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleMainSort('score')}
              >
                <div className="flex items-center justify-center gap-1">
                  <span>TAS Avg Score (%)</span>
                  <span className="inline-flex flex-col -space-y-1">
                    <ChevronUp className={`w-3 h-3 ${mainSortColumn === 'score' && mainSortDirection === 'asc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                    <ChevronDown className={`w-3 h-3 ${mainSortColumn === 'score' && mainSortDirection === 'desc' ? 'opacity-100 text-gray-700' : 'opacity-40'}`} />
                  </span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, index) => (
              <tr
                key={`${item.zone}-${index}`}
                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                onClick={() => {
                  if (onZoneSelect) onZoneSelect(item.zone);
                  setTimeout(() => {
                    const chartElement = document.getElementById('performance-score-breakdown-chart');
                    if (chartElement) chartElement.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
                  }, 100);
                }}
              >
                <td
                  className="py-1 pr-2 pl-2 text-xs text-blue-600 whitespace-nowrap cursor-pointer hover:bg-gray-100 hover:text-blue-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onZoneSelect) onZoneSelect(item.zone);
                    setTimeout(() => {
                      const chartElement = document.getElementById('performance-score-breakdown-chart');
                      if (chartElement) chartElement.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
                    }, 100);
                  }}
                >
                  {item.zone}
                </td>
                <td className="py-1.5 px-2 text-xs font-semibold text-gray-900 whitespace-nowrap">
                  {(item.score ?? 0) === 0 ? '-' : item.rank}
                </td>
                <td className="py-1 px-1.5 text-center">
                  {(item.score ?? 0) === 0 ? (
                    <span className="text-xs text-red-600 inline-block" title="TAS not integrated with Novex">
                      -----
                    </span>
                  ) : (
                    <div className="flex items-center justify-center gap-2 w-full">
                      <div className="tas-gov-score-bar-track flex-1 bg-gray-300 rounded-full h-4 relative min-w-0">
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
                      <span className="text-xs text-gray-600 ml-2 whitespace-nowrap flex-shrink-0">
                        ({item.locationCount} locations)
                      </span>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-0 bg-white border-t border-gray-200 py-2 px-2 flex-shrink-0">
        <div className="flex gap-3 items-center text-xs justify-center flex-wrap">
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className="w-3 h-3 rounded flex-shrink-0" style={{ background: 'linear-gradient(to right,rgb(93, 202, 46), #5CB338)' }} />
            <span className="text-gray-600 whitespace-nowrap text-xs">Excellent (95-100%)</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className="w-3 h-3 rounded flex-shrink-0" style={{ background: 'linear-gradient(to right,rgb(235, 189, 39), #eab308)' }} />
            <span className="text-gray-600 whitespace-nowrap text-xs">Good (80-94%)</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className="w-3 h-3 rounded flex-shrink-0" style={{ background: 'linear-gradient(to right,rgb(208, 49, 49), #dc2626)' }} />
            <span className="text-gray-600 whitespace-nowrap text-xs">Needs Improvement (&lt;80%)</span>
          </div>
        </div>
      </div>

      {isDialogOpen && (
        <>
          <style>{`@keyframes tasSheetSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
          <button
            onClick={() => setIsDialogOpen(false)}
            aria-label="Close"
            className="fixed z-[9999] flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-md transition-colors hover:bg-gray-100"
            style={{ left: `${closeButtonLeft}px`, top: '24px', width: '36px', height: '36px' }}
          >
            <X className="w-5 h-5" />
          </button>
          <div className="fixed inset-0 bg-black/50 flex justify-end z-50 transition-opacity duration-200" onClick={() => setIsDialogOpen(false)}>
            <div
              className="bg-white w-[89vw] h-full flex flex-col shadow-2xl"
              style={{ animation: 'tasSheetSlideIn 0.3s ease-out forwards' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-bold text-gray-900">TAS Details for {selectedLocationData?.name || 'Location'}</h3>
              </div>
              <div className="flex-1 overflow-hidden flex flex-col">
                {isLoadingTasData ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    <span className="ml-2 text-sm text-gray-600">Loading TAS data...</span>
                  </div>
                ) : tasCategoryData ? (
                  <div className="flex-1 flex flex-col p-6 overflow-hidden">
                    <div className="border border-gray-300 rounded-lg overflow-hidden flex-1 overflow-y-auto">
                      <table className="w-full bg-white" style={{ borderCollapse: 'collapse' }}>
                        <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                            <th className="text-left py-1.5 px-4 text-xs font-semibold text-gray-700 border-b border-gray-300 border-r border-gray-300 w-[32%]">Module</th>
                            <th className="text-left py-1.5 px-4 text-xs font-semibold text-gray-700 border-b border-gray-300 border-r border-gray-300 w-[34%]">Parameter</th>
                            <th className="text-right py-1.5 px-4 text-xs font-semibold text-gray-700 border-b border-gray-300 border-r border-gray-300 w-[11%]">Score</th>
                            <th className="text-right py-1.5 px-4 text-xs font-semibold text-gray-700 border-b border-gray-300 border-r border-gray-300 w-[11%]">Weightage</th>
                            <th className="text-right py-1.5 px-4 text-xs font-semibold text-gray-700 border-b border-gray-300 w-[12%]">Weighted Score</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          {tasCategoryData.results?.length > 0 ? (
                            tasCategoryData.results.map((module: any, moduleIndex: number) => {
                              const hasNestedResults = module.results && module.results.length > 0;
                              const isModuleExpanded = expandedModules.has(moduleIndex);
                              const moduleStatus = getStatus(module.score || 0, module.weightage || 0);
                              const weightedScore = calculateWeightedScore(module.score || 0, module.weightage || 0);
                              return (
                                <React.Fragment key={moduleIndex}>
                                  <tr className="border-b border-gray-300 hover:bg-gray-50 cursor-pointer" onClick={() => hasNestedResults && toggleModule(moduleIndex)}>
                                    <td className="py-1.5 px-4 border-r border-gray-300">
                                      <div className="flex items-center gap-1.5">
                                        {hasNestedResults ? (
                                          isModuleExpanded ? (
                                            <div className="w-3.5 h-3.5 border border-gray-400 rounded flex items-center justify-center">
                                              <Minus className="w-2.5 h-2.5 text-gray-600" />
                                            </div>
                                          ) : (
                                            <div className="w-3.5 h-3.5 border border-gray-400 rounded flex items-center justify-center">
                                              <Plus className="w-2.5 h-2.5 text-gray-600" />
                                            </div>
                                          )
                                        ) : (
                                          <div className="w-3.5 h-3.5" />
                                        )}
                                        <span className="text-xs text-gray-900">{module.name || '-'}</span>
                                      </div>
                                    </td>
                                    <td className="py-1.5 px-4 border-r border-gray-300" />
                                    <td className={`py-1.5 px-4 text-xs font-semibold text-right tabular-nums border-r border-gray-300 ${moduleStatus.scoreColor}`}>
                                      {module.score !== undefined ? module.score.toFixed(2) : '-'}
                                    </td>
                                    <td className="py-1.5 px-4 text-xs text-gray-700 text-right border-r border-gray-300">
                                      {module.weightage != null ? `${Number(module.weightage) % 1 === 0 ? Number(module.weightage) : Number(module.weightage).toFixed(2)}%` : '-'}
                                    </td>
                                    <td className="py-1.5 px-4 text-xs text-gray-700 text-right tabular-nums">{weightedScore}</td>
                                  </tr>
                                  {hasNestedResults && isModuleExpanded && module.results.map((param: any, paramIndex: number) => {
                                    const paramStatus = getStatus(param.score || 0, param.weightage || 0);
                                    const paramWeightedScore = calculateWeightedScore(param.score || 0, param.weightage || 0);
                                    return (
                                      <tr key={`${moduleIndex}-${paramIndex}`} className="border-b border-gray-300 hover:bg-gray-50/50">
                                        <td className="py-1.5 px-4 border-r border-gray-300" />
                                        <td className="py-1.5 px-4 border-r border-gray-300">
                                          <span className="text-xs text-gray-700">{param.name || '-'}</span>
                                        </td>
                                        <td className={`py-1.5 px-4 text-xs font-medium text-right tabular-nums border-r border-gray-300 ${paramStatus.scoreColor}`}>
                                          {param.score !== undefined ? param.score.toFixed(2) : '-'}
                                        </td>
                                        <td className="py-1.5 px-4 text-xs text-gray-700 text-right border-r border-gray-300">
                                          {param.weightage != null ? `${Number(param.weightage) % 1 === 0 ? Number(param.weightage) : Number(param.weightage).toFixed(2)}%` : '-'}
                                        </td>
                                        <td className="py-1.5 px-4 text-xs text-gray-700 text-right tabular-nums">{paramWeightedScore}</td>
                                      </tr>
                                    );
                                  })}
                                </React.Fragment>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={5} className="py-16 text-center">
                                <div className="flex flex-col items-center gap-3">
                                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414A1 1 0 006.586 13H4" />
                                    </svg>
                                  </div>
                                  <div className="text-sm font-medium text-gray-700">No data available</div>
                                  <div className="text-xs text-gray-500">No TAS breakdown data found</div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-sm text-gray-500">No TAS data available for this location</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PerformanceScoreZone;