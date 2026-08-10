import React, { useEffect, useMemo, useState } from 'react';

import { apiClient } from "@/services/apiClient";
import useAuthStore from "@/store/authStore";
import { Loader2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/@/components/ui/tooltip";

// Default data structure (will be replaced by API data)
const defaultData = [];

const getColorForScore = (score: number) => {
  if (score >= 95) return { light: "#5CB338", lighter: "#7dd84a" }; // Green for 95-100%
  if (score >= 80) return { light: "#eab308", lighter: "#fde047" }; // Yellow for 80-94%
  return { light: "#dc2626", lighter: "#ef4444" }; // Red for <80%
};

/** First non-empty zone / SAP from session (`/api/session/me`); matches Terminal Home `get_pi_score` / `get_dist_loc_details`. */
function firstUserScopeToken(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) {
    for (const x of v) {
      const s = String(x).trim();
      if (s) return s;
    }
    return "";
  }
  return String(v).trim();
}

interface PerformanceScoreCardProps {
  timeFilter?: string | any;
  dateRangeFilter?: any;
  height?: number;
  refreshTrigger?: number;
  onLocationSelect?: (locationName: string, zone: string) => void;
  onFirstLocationLoaded?: (locationName: string, zone: string) => void;
  /** Heading text for the card (e.g. "TAS Score" on TAS Home, "Performance Score" elsewhere) */
  heading?: string;
  /** Business unit for `/api/performanceindex/get_pi_score` (e.g. `TAS` on Terminal Home, `RO` on RO Home). */
  bu?: string;
  /** When set, overrides login `zone` / `sap_id` in the payload (same shape as `TASScoreCard`). */
  locationFilter?: { zone?: string | null; plant?: string | null };
}

const PerformanceScoreCard: React.FC<PerformanceScoreCardProps> = ({
  timeFilter,
  dateRangeFilter,
  height = 600,
  refreshTrigger = 0,
  onLocationSelect,
  onFirstLocationLoaded,
  heading = "Performance Score",
  bu = "TAS",
  locationFilter,
}) => {
  const user = useAuthStore((s) => s.user);
  const userZone = useMemo(() => firstUserScopeToken(user?.zone), [user?.zone]);
  const userSapId = useMemo(() => firstUserScopeToken(user?.sap_id), [user?.sap_id]);

  const [performanceData, setPerformanceData] = useState(defaultData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<'location' | 'zone'>('location');
  const [hasNotifiedFirstLocation, setHasNotifiedFirstLocation] = useState(false);
  const [columnWidths, setColumnWidths] = useState({});
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'rank',
    direction: 'asc'
  });

  // Calculate zone averages for zone view mode and sort by avg score
  const calculateZoneAverages = () => {
    const zoneGroups: { [key: string]: { totalScore: number; count: number; locations: any[] } } = {};

    // Group locations by zone
    performanceData.forEach(item => {
      if (!zoneGroups[item.zone]) {
        zoneGroups[item.zone] = { totalScore: 0, count: 0, locations: [] };
      }
      zoneGroups[item.zone].totalScore += item.score;
      zoneGroups[item.zone].count += 1;
      zoneGroups[item.zone].locations.push(item);
    });

    // Convert to array with calculated averages
    const zoneAverages = Object.entries(zoneGroups).map(([zone, data]) => ({
      zone,
      score: Math.round((data.totalScore / data.count) * 100) / 100,
      locationCount: data.count,
      locations: data.locations
    }));

    // Sort by overall average score descending (highest avg score first)
    const sortedZones = zoneAverages.sort((a, b) => b.score - a.score);

    // Assign ranks based on sorted order (highest avg score = rank 1)
    return sortedZones.map((zone, index) => ({
      ...zone,
      rank: index + 1
    }));
  };

  // Filter data based on search term and view mode
  const filteredData = viewMode === 'location'
    ? performanceData.filter(item =>
      item.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.zone.toLowerCase().includes(searchTerm.toLowerCase())
    )
    : calculateZoneAverages().filter(item =>
      item.zone.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedData = [...filteredData].sort((a: any, b: any) => {
    // Handle string comparison specifically for text columns
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortConfig.direction === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    if (aValue < bValue) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  useEffect(() => {
    const fetchPerformanceData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Use provided dates or default to today (same logic as other components)
        let defaultStartDate: string;
        let defaultEndDate: string;

        if (dateRangeFilter) {
          [defaultStartDate, defaultEndDate] = dateRangeFilter.value.split(",");
        } else {
          defaultStartDate = new Date().toISOString().split('T')[0];
          defaultEndDate = new Date().toISOString().split('T')[0];
        }

        const zoneFromFilter = (locationFilter?.zone ?? "").toString().trim();
        const sapFromFilter = (locationFilter?.plant ?? "").toString().trim();
        const zone = zoneFromFilter || userZone;
        const sap_id = sapFromFilter || userSapId;

        const payload = {
          bu,
          "category": "",
          "region": "",
          zone,
          sap_id,
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
            // Transform: use overall_oi_score and rank from API; category from API (e.g. [{name: "VA", score, weightage}, ...])
            const transformedUnsorted = dataArray.map((item: any, index: number) => ({
              location: item.name || item.location || `Location ${index + 1}`,
              zone: item.zone || '',
              region: item.region,
              sap_id: item.sap_id,
              score: item.overall_oi_score ?? item.score ?? 0,
              rank: item.rank != null ? item.rank : index + 1,
              cells: item.category && Array.isArray(item.category) ? item.category.length : 0,
              category: item.category,
              tas_category_scores: item.tas_category_scores,
              national_score: item.national_score
            }));

            // Sort by rank ascending (rank 1 first) so table order matches API ranking
            const transformedData = [...transformedUnsorted].sort((a: any, b: any) => (a.rank ?? 0) - (b.rank ?? 0));

            setPerformanceData(transformedData);

            // Notify parent about first location for default chart display (only once)
            if (transformedData.length > 0 && onFirstLocationLoaded && viewMode === 'location' && !hasNotifiedFirstLocation) {
              const firstLocation = transformedData[0];
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
  }, [timeFilter, dateRangeFilter, refreshTrigger, bu, userZone, userSapId, locationFilter?.zone, locationFilter?.plant]);

  // Reset notification flag when refresh trigger changes
  useEffect(() => {
    setHasNotifiedFirstLocation(false);
  }, [refreshTrigger]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col">
        <h3 className="text-base font-semibold text-gray-900 mb-3">{heading}</h3>
        {/* <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">Loading performance data...</div>
        </div> */}
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
        <h3 className="text-base font-semibold text-gray-900 mb-3">{heading}</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-red-500">data unavailable </div>
        </div>
      </div>
    );
  }

  const renderSortIcon = (key: string) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="h-3 w-3 text-gray-400 ml-1 inline opacity-50 hover:opacity-100" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="h-3 w-3 text-blue-600 ml-1 inline" />
      : <ArrowDown className="h-3 w-3 text-blue-600 ml-1 inline" />;
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="w-full flex flex-col bg-white" style={{ height: `${height}px` }}>
        {/* Header with Search in Same Row */}
<div className="flex flex-col gap-1 pb-2 flex-shrink-0">
  {/* Heading */}
  <h3 className="text-sm font-semibold text-gray-900">
    {heading}
  </h3>

  {/* Search + Radio (same line, below heading) */}
  <div className="flex items-center gap-3 text-xs whitespace-nowrap">
    {/* Search */}
    <div className="relative w-full">
      <input
        type="text"
        placeholder="Search"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full pl-6 pr-2 py-1 text-[11px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <div className="absolute inset-y-0 left-0 pl-1.5 flex items-center pointer-events-none">
        <svg className="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
    </div>

    {/* Radio buttons */}
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-1 cursor-pointer">
        <input
          type="radio"
          name="viewMode"
          value="location"
          checked={viewMode === 'location'}
          onChange={(e) => setViewMode(e.target.value as 'location' | 'zone')}
          className="text-blue-600 focus:ring-blue-500 scale-90"
        />
        Location
      </label>

      <label className="flex items-center gap-1 cursor-pointer">
        <input
          type="radio"
          name="viewMode"
          value="zone"
          checked={viewMode === 'zone'}
          onChange={(e) => setViewMode(e.target.value as 'location' | 'zone')}
          className="text-blue-600 focus:ring-blue-500 scale-90"
        />
        Zone
      </label>
    </div>
  </div>
</div>



      <div className="flex-1 overflow-y-auto min-h-0">
        <table className="w-full border-collapse table-fixed">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b-2 border-gray-200">
              {viewMode === 'location' && (
                <th
                  className="text-left py-1.5 pr-2 pl-2 font-semibold text-xs text-gray-700 cursor-pointer select-none group hover:bg-gray-50 transition-colors"
                  style={{
                    width: `${columnWidths['location'] || 110}px`,
                    maxWidth: columnWidths['location'] ? `${columnWidths['location']}px` : 'none'
                  }}
                  onClick={() => handleSort('location')}
                >
                  Location {renderSortIcon('location')}
                </th>
              )}
              <th
                className="text-left py-1.5 px-2 font-semibold text-xs text-gray-700 cursor-pointer select-none group hover:bg-gray-50 transition-colors"
                style={{
                  width: `${columnWidths['zone'] || 40}px`,
                  maxWidth: columnWidths['zone'] ? `${columnWidths['zone']}px` : 'none'
                }}
                onClick={() => handleSort('zone')}
              >
                Zone {renderSortIcon('zone')}
              </th>
              <th
                className="text-left py-1.5 px-2 font-semibold text-xs text-gray-700 cursor-pointer select-none group hover:bg-gray-50 transition-colors"
                style={{
                  width: `${columnWidths['rank'] || 40}px`,
                  maxWidth: columnWidths['rank'] ? `${columnWidths['rank']}px` : 'none'
                }}
                onClick={() => handleSort('rank')}
              >
                Rank {renderSortIcon('rank')}
              </th>
              <th
                className="text-left py-1.5 px-2 font-semibold text-xs text-gray-700 cursor-pointer select-none group hover:bg-gray-50 transition-colors"
                style={{
                  width: `${columnWidths['score'] || 120}px`,
                  maxWidth: columnWidths['score'] ? `${columnWidths['score']}px` : 'none'
                }}
                onClick={() => handleSort('score')}
              >
                {viewMode === 'location' ? 'Overall OI Score' : 'Overall Avg PI Score'} {renderSortIcon('score')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((item, index) => (
              <tr
                key={index}
                className="border-b border-gray-100 hover:bg-gray-50"
              >
                {viewMode === 'location' && (
                  <td
                    className="py-1.5 pr-2 pl-2 text-xs font-medium text-blue-600 whitespace-nowrap hover:text-blue-700"
                    style={{
                      width: `${columnWidths['location'] || 120}px`,
                      maxWidth: columnWidths['location'] ? `${columnWidths['location']}px` : 'none'
                    }}
                  >
                    {item.location && item.location.length > 15 ? (
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">
                            {`${item.location.substring(0, 15)}...`}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{item.location}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      item.location
                    )}
                  </td>
                )}
                <td
                  className="py-1.5 pr-4 pl-4 text-xs text-gray-900 whitespace-nowrap"
                  style={{
                    width: `${columnWidths['zone'] || 40}px`,
                    maxWidth: columnWidths['zone'] ? `${columnWidths['zone']}px` : 'none'
                  }}
                >
                  {item.zone}
                </td>
                <td
                  className="py-1.5 px-2 text-xs font-semibold text-gray-900 whitespace-nowrap"
                  style={{
                    width: `${columnWidths['rank'] || 40}px`,
                    maxWidth: columnWidths['rank'] ? `${columnWidths['rank']}px` : 'none'
                  }}
                >
                  {item.rank}
                </td>
                <td
                  className="py-1.5 px-2"
                  style={{
                    width: `${columnWidths['score'] || 150}px`,
                    maxWidth: columnWidths['score'] ? `${columnWidths['score']}px` : 'none'
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-300 rounded-full h-5 min-w-[40px] max-w-[100px] relative overflow-hidden">
                      <div
                        className="h-full rounded-full flex items-center justify-end pr-1.5 transition-all duration-300"
                        style={{
                          width: `${item.score}%`,
                          background: `linear-gradient(to right, ${getColorForScore(item.score).lighter}, ${getColorForScore(item.score).light})`,
                        }}
                      >
                        <span className="text-xs font-semibold text-white">{item.score}%</span>
                      </div>
                    </div>
                    {viewMode === 'zone' && (
                      <span className="text-xs text-gray-600 ml-2">
                        ({item.locationCount} locations)
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sticky Legend at Bottom */}
      <div className="bottom-0 bg-white border-t border-gray-200 pt-2 pb-0 px-0.5 flex-shrink-0">
        <div className="mx-auto max-w-[340px]">
          <div className="flex items-center justify-between gap-2 text-[10px] whitespace-nowrap">
            <div className="flex items-center gap-1">
              <div
                className="w-2.5 h-2.5 rounded"
                style={{ background: 'linear-gradient(to right, rgb(93, 202, 46), #5CB338)' }}
              />
              <span className="text-gray-600">Excellent (95–100%)</span>
            </div>

            <div className="flex items-center gap-1">
              <div
                className="w-2.5 h-2.5 rounded"
                style={{ background: 'linear-gradient(to right, rgb(235, 189, 39), #eab308)' }}
              />
              <span className="text-gray-600">Good (80–94%)</span>
            </div>

            <div className="flex items-center gap-1">
              <div
                className="w-2.5 h-2.5 rounded"
                style={{ background: 'linear-gradient(to right, rgb(208, 49, 49), #dc2626)' }}
              />
              <span className="text-gray-600">Needs Improvement (&lt;80%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
};

export default PerformanceScoreCard;