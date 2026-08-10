import React, { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/services/apiClient';
import useAuthStore from '@/store/authStore';
import { Loader2, Info, Plus, Minus } from 'lucide-react';
import { cn } from '@/@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/@/components/ui/sheet';
import { Badge } from '@/@/components/ui/badge';
import { Switch } from '@/@/components/ui/switch';
import { Label } from '@/@/components/ui/label';

const defaultData: {
  location: string;
  zone: string;
  rank: number;
  score: number;
  sap_id?: string;
  fullData?: any;
  locationCount?: number;
  locations?: any[];
}[] = [];

const getColorForScore = (score: number) => {
  if (score >= 95) return { light: '#5CB338', lighter: '#7dd84a' };
  if (score >= 80) return { light: '#eab308', lighter: '#fde047' };
  return { light: '#dc2626', lighter: '#ef4444' };
};

/** First non-empty zone / SAP from session — same contract as Terminal Home filters. */
function firstUserScopeToken(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) {
    for (const x of v) {
      const s = String(x).trim();
      if (s) return s;
    }
    return '';
  }
  return String(v).trim();
}

/** Weightage column as % — trim trailing zeros (e.g. 30%, 2.14%). */
const formatWeightageDisplay = (w: number) => {
  const n = Number(w) || 0;
  const s = n.toFixed(2).replace(/\.?0+$/, '');
  return `${s}%`;
};

export interface TASScoreCardProps {
  timeFilter?: string | { key: string; cond: string; value: string };
  dateRangeFilter?: { value?: string } | null;
  /** When set, forwarded to `get_pi_score` as `zone` and `sap_id` (plant). */
  locationFilter?: { zone?: string | null; plant?: string | null };
  height?: number;
  refreshTrigger?: number;
  onLocationSelect?: (locationName: string, zone: string) => void;
  onFirstLocationLoaded?: (locationName: string, zone: string) => void;
}

/**
 * TAS Score card that fetches data from the same API as TAS Governance Dashboard
 * (get_pi_score) with Plant / Zone view toggle.
 */
const TASScoreCard: React.FC<TASScoreCardProps> = ({
  timeFilter,
  dateRangeFilter,
  locationFilter,
  height = 360,
  refreshTrigger = 0,
  onFirstLocationLoaded,
}) => {
  const user = useAuthStore((s) => s.user);
  const sessionZone = useMemo(() => firstUserScopeToken(user?.zone), [user?.zone]);
  const sessionSap = useMemo(() => firstUserScopeToken(user?.sap_id), [user?.sap_id]);

  const [performanceData, setPerformanceData] = useState(defaultData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'plant' | 'zone'>('plant');
  const [hasNotifiedFirstLocation, setHasNotifiedFirstLocation] = useState(false);
  /** Plant row whose category breakdown is shown in the dialog */
  const [categoryDetailRow, setCategoryDetailRow] = useState<(typeof defaultData)[number] | null>(null);
  /** Which TAS module rows are expanded in the sheet */
  const [tasSheetExpanded, setTasSheetExpanded] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!categoryDetailRow) {
      setTasSheetExpanded(new Set());
      return;
    }
    const cat = categoryDetailRow.fullData?.category;
    const tas = Array.isArray(cat)
      ? cat.find((c: any) => String(c?.name ?? '').toUpperCase() === 'TAS')
      : null;
    const modules = Array.isArray(tas?.results) ? tas.results : [];
    setTasSheetExpanded(new Set(modules.map((_: any, i: number) => `tas-mod-${i}`)));
  }, [categoryDetailRow]);

  const calculateZoneAverages = () => {
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
      location: '',
      rank: 0,
    }));
    const sortedZones = zoneAverages.sort((a, b) => b.score - a.score);
    let currentRank = 1;
    return sortedZones.map((z, index) => {
      if (index > 0 && z.score !== sortedZones[index - 1].score) currentRank++;
      return { ...z, rank: currentRank };
    });
  };

  const getFilteredData = () => {
    const data = viewMode === 'plant' ? performanceData : calculateZoneAverages();
    return viewMode === 'plant'
      ? data.filter(
        (item: any) =>
          item.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.zone.toLowerCase().includes(searchTerm.toLowerCase())
      )
      : data.filter((item: any) => item.zone.toLowerCase().includes(searchTerm.toLowerCase()));
  };

  const sortedData = getFilteredData();

  const calculateTasAverage = () => {
    if (performanceData.length === 0) return 0;
    const total = performanceData.reduce((sum, item) => sum + (item.score || 0), 0);
    return Math.round((total / performanceData.length) * 100) / 100;
  };
  const tasAverageScore = calculateTasAverage();

  useEffect(() => {
    const fetchPerformanceData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        let defaultStartDate: string;
        let defaultEndDate: string;

        if (dateRangeFilter?.value) {
          const parts = dateRangeFilter.value.split(',');
          defaultStartDate = parts[0] || new Date().toISOString().split('T')[0];
          defaultEndDate = parts[1] || defaultStartDate;
        } else {
          defaultStartDate = new Date().toISOString().split('T')[0];
          defaultEndDate = defaultStartDate;
        }

        const zoneFromUi = (locationFilter?.zone ?? '').toString().trim();
        const sapFromUi = (locationFilter?.plant ?? '').toString().trim();
        const zone = zoneFromUi || sessionZone;
        const sap_id = sapFromUi || sessionSap;

        const payload = {
          bu: 'TAS',
          category: '',
          region: '',
          zone,
          sap_id,
          strategy: '',
          filters: [
            {
              key: 'created_at',
              cond: 'date_filter',
              value: `${defaultStartDate},${defaultEndDate}`,
              val: '',
            },
          ],
          is_plant: true,
        };

        const response = await apiClient.post('/api/performanceindex/get_pi_score', payload);

        if (response?.data) {
          const apiData = response.data;
          let dataArray: any[] = Array.isArray(apiData)
            ? apiData
            : typeof apiData === 'object' && apiData !== null
              ? Object.values(apiData)
              : [];

          if (dataArray.length > 0) {
            const transformedData = dataArray.map((item: any, index: number) => {
              const tasCategory = item.category?.find((cat: any) => cat.name === 'TAS');
              let tasScore = 0;
              let tasWeightage = 20;
              if (tasCategory && tasCategory.score !== undefined) {
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
                sap_id: item.sap_id || '',
                fullData: item,
              };
            });
            const sorted = transformedData.sort((a: any, b: any) => b.score - a.score);

            // Don't show locations/zones where TAS score is 0 (same as TAS Governance)
            const sortedNonZero = sorted.filter((item: any) => (item.score ?? 0) > 0);

            let currentRank = 1;
            const rankedData = sortedNonZero.map((item: any, index: number) => {
              if (index > 0 && item.score !== sortedNonZero[index - 1].score) currentRank++;
              return { ...item, rank: currentRank };
            });
            setPerformanceData(rankedData);

            if (
              rankedData.length > 0 &&
              onFirstLocationLoaded &&
              viewMode === 'plant' &&
              !hasNotifiedFirstLocation
            ) {
              const first = rankedData[0];
              onFirstLocationLoaded(first.location, first.zone);
              setHasNotifiedFirstLocation(true);
            }
          } else {
            setPerformanceData([]);
          }
        }
      } catch (err: any) {
        console.error('Failed to fetch TAS Score:', err);
        setError(err?.response?.data?.message || err.message || 'Failed to load data');
        setPerformanceData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPerformanceData();
  }, [
    timeFilter,
    dateRangeFilter,
    refreshTrigger,
    sessionZone,
    sessionSap,
    locationFilter?.zone,
    locationFilter?.plant,
  ]);

  useEffect(() => {
    setHasNotifiedFirstLocation(false);
    setSearchTerm('');
  }, [refreshTrigger]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col bg-white rounded-lg border border-gray-200 p-4" style={{ height: `${height}px` }}>
        <h3 className="text-base font-semibold text-gray-900 mb-3">TAS Score</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Loading TAS Score...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex flex-col bg-white rounded-lg border border-gray-200 p-4" style={{ height: `${height}px` }}>
        <h3 className="text-base font-semibold text-gray-900 mb-3">TAS Score</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-red-500">Data unavailable</div>
        </div>
      </div>
    );
  }

  const categoryList = categoryDetailRow?.fullData?.category;
  const tasCategory = Array.isArray(categoryList)
    ? categoryList.find((c: any) => String(c?.name ?? '').toUpperCase() === 'TAS')
    : undefined;
  const tasNestedRows = Array.isArray(tasCategory?.results) ? tasCategory.results : [];
  const hasTasNestedTable = tasNestedRows.length > 0;

  const allTasModuleKeys = tasNestedRows.map((_: unknown, i: number) => `tas-mod-${i}`);
  const allTasModulesExpanded =
    allTasModuleKeys.length > 0 && allTasModuleKeys.every((k) => tasSheetExpanded.has(k));

  const toggleTasModuleRow = (key: string) => {
    setTasSheetExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAllTasSheetModules = () => {
    setTasSheetExpanded(new Set(tasNestedRows.map((_: unknown, i: number) => `tas-mod-${i}`)));
  };

  const collapseAllTasSheetModules = () => setTasSheetExpanded(new Set());

  return (
    <>
      <div
        className="w-full flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm"
        style={{ height: `${height}px` }}
      >
        <div className="flex flex-col gap-2 pb-2 flex-shrink-0 px-2 pt-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-gray-900">
              TAS Score
              {tasAverageScore > 0 && (
                <span className="ml-2 text-blue-600 font-semibold">
                  (TAS avg-{tasAverageScore.toFixed(2)} %)
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 p-0.5 rounded-md bg-gray-100 w-fit">
                <button
                  type="button"
                  onClick={() => setViewMode('plant')}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded transition-colors',
                    viewMode === 'plant'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  Plant
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('zone')}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded transition-colors',
                    viewMode === 'zone'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  Zone
                </button>
              </div>
              <div className="relative w-36">
                <input
                  type="text"
                  placeholder={
                    viewMode === 'plant' ? 'Search locations/zones...' : 'Search zones...'
                  }
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
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-2 [-webkit-tap-highlight-color:transparent]">
          <table
            className={cn(
              'w-full border-collapse table-auto',
              /* Force arrow cursor — Zone/Rank (and headers) must not show pointer/finger (looks clickable). */
              '[&_th]:!cursor-default [&_td]:!cursor-default [&_td_*]:!cursor-default'
            )}
          >
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b-2 border-gray-200">
                {viewMode === 'plant' && (
                  <>
                    <th className="text-left py-1.5 pr-2 pl-2 font-semibold text-xs text-gray-700 select-none">
                      Location
                    </th>
                    <th className="text-left py-1.5 px-2 font-semibold text-xs text-gray-700 w-auto select-none">
                      Zone
                    </th>
                    <th className="text-left py-1.5 px-2 font-semibold text-xs text-gray-700 w-auto select-none">
                      Rank
                    </th>
                    <th className="text-center py-1 px-2 font-semibold text-xs text-gray-700 whitespace-nowrap select-none">
                      TAS Score (%)
                    </th>
                  </>
                )}
                {viewMode === 'zone' && (
                  <>
                    <th className="text-left py-1.5 px-2 font-semibold text-xs text-gray-700 select-none">Zone</th>
                    <th className="text-left py-1.5 px-2 font-semibold text-xs text-gray-700 select-none">Rank</th>
                    <th className="text-center py-1 px-2 font-semibold text-xs text-gray-700 whitespace-nowrap select-none">
                      TAS Avg Score (%)
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((item, index) => (
                <tr
                  key={viewMode === 'plant' ? `${item.location}-${index}` : `${item.zone}-${index}`}
                  className="cursor-default border-b border-gray-100"
                >
                  {viewMode === 'plant' && (
                    <>
                      <td className="py-1.5 pr-2 pl-2 text-xs font-normal text-blue-600 align-top break-words min-w-0">
                        {item.location}
                      </td>
                      <td className="py-1.5 px-2 text-xs text-gray-600 align-top break-words min-w-0">
                        {item.zone}
                      </td>
                      <td className="py-1.5 px-2 text-xs font-normal tabular-nums text-gray-700 align-top whitespace-nowrap min-w-0">
                        {(item.score ?? 0) === 0 ? '-' : item.rank}
                      </td>
                      <td className="py-1 px-2 text-center">
                        {(item.score ?? 0) === 0 ? (
                          <span className="text-xs text-red-600" title="TAS not integrated with Novex">
                            -----
                          </span>
                        ) : (
                          <div
                            className="flex items-center justify-center gap-1 w-full min-w-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex-1 bg-gray-300 rounded-full h-5 relative min-w-0">
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
                                <span className="text-xs font-normal text-white whitespace-nowrap">
                                  {Number(item.score).toFixed(2)}%
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="inline-flex shrink-0 rounded-full p-0.5 text-gray-500 hover:bg-blue-100 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
                              title="TAS nested breakdown"
                              aria-label="Open TAS line items"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCategoryDetailRow(item);
                              }}
                            >
                              <Info className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </>
                  )}
                  {viewMode === 'zone' && (
                    <>
                      <td className="py-1.5 pr-2 pl-2 text-xs font-normal text-gray-700 align-top break-words min-w-0">
                        {item.zone}
                      </td>
                      <td className="py-1.5 px-2 text-xs font-normal tabular-nums text-gray-700 align-top whitespace-nowrap min-w-0">
                        {(item.score ?? 0) === 0 ? '-' : item.rank}
                      </td>
                      <td className="py-1 px-2 text-center">
                        {(item.score ?? 0) === 0 ? (
                          <span className="text-xs text-red-600" title="TAS not integrated with Novex">
                            -----
                          </span>
                        ) : (
                          <div className="flex items-center justify-center gap-2 w-full">
                            <div className="flex-1 bg-gray-300 rounded-full h-4 relative">
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
                                <span className="text-xs font-normal text-white whitespace-nowrap">
                                  {Number(item.score).toFixed(2)}%
                                </span>
                              </div>
                            </div>
                            <span className="text-xs text-gray-600 whitespace-nowrap">
                              ({item.locationCount} locations)
                            </span>
                          </div>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-gray-200 pt-2 pb-2 px-2 flex-shrink-0">
          <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] text-gray-600">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded inline-block" style={{ background: 'linear-gradient(to right, rgb(93, 202, 46), #5CB338)' }} />
              Excellent (95–100%)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded inline-block" style={{ background: 'linear-gradient(to right, rgb(235, 189, 39), #eab308)' }} />
              Good (80–94%)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded inline-block" style={{ background: 'linear-gradient(to right, rgb(208, 49, 49), #dc2626)' }} />
              Needs Improvement (&lt;80%)
            </span>
          </div>
        </div>
      </div>

      {categoryDetailRow != null && (
        <Sheet open onOpenChange={(open) => !open && setCategoryDetailRow(null)}>
          <SheetContent
            side="right"
            className="flex min-w-0 w-full flex-col gap-0 border-l border-gray-200 bg-white p-0 shadow-xl sm:max-w-xl md:max-w-2xl lg:max-w-3xl"
          >
            <SheetHeader className="shrink-0 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4 text-left">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2 sm:gap-x-3">
                <SheetTitle className="min-w-0 shrink text-base font-semibold text-gray-900">
                  TAS — detail breakdown
                </SheetTitle>
                {categoryDetailRow ? (
                  <>
                    <Badge
                      variant="outline"
                      className="max-w-[min(100%,14rem)] shrink-0 truncate border-sky-200 bg-sky-50 font-medium text-sky-900 shadow-sm"
                      title={categoryDetailRow.location}
                    >
                      {categoryDetailRow.location}
                    </Badge>
                    {categoryDetailRow.zone ? (
                      <Badge
                        variant="outline"
                        className="shrink-0 border-emerald-200 bg-emerald-50 font-medium text-emerald-900 shadow-sm"
                      >
                        Zone {categoryDetailRow.zone}
                      </Badge>
                    ) : null}
                    {categoryDetailRow.sap_id ? (
                      <Badge
                        variant="outline"
                        className="shrink-0 border-amber-200 bg-amber-50 font-mono text-[11px] font-medium text-amber-950 shadow-sm"
                      >
                        SAP {categoryDetailRow.sap_id}
                      </Badge>
                    ) : null}
                    <SheetDescription className="sr-only">
                      {`${categoryDetailRow.location}${categoryDetailRow.zone ? `, Zone ${categoryDetailRow.zone}` : ''}${categoryDetailRow.sap_id ? `, SAP ${categoryDetailRow.sap_id}` : ''}`}
                    </SheetDescription>
                  </>
                ) : null}
                {hasTasNestedTable ? (
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    <Label htmlFor="tas-sheet-expand-all" className="text-xs font-medium text-gray-800 cursor-pointer">
                      Expand all
                    </Label>
                    <Switch
                      id="tas-sheet-expand-all"
                      checked={allTasModulesExpanded}
                      onCheckedChange={(checked) =>
                        checked ? expandAllTasSheetModules() : collapseAllTasSheetModules()
                      }
                      aria-label="Expand or collapse all modules"
                    />
                  </div>
                ) : null}
              </div>
            </SheetHeader>

            <div className="isolate min-h-0 min-w-0 flex-1 overflow-y-auto px-3 pb-4 pt-0 sm:px-4">
              {!tasCategory ? (
                <p className="text-sm text-gray-500 py-2">No TAS category in the response for this location.</p>
              ) : !hasTasNestedTable ? (
                <p className="text-sm text-gray-500 py-2">No nested line items under TAS for this location.</p>
              ) : (
                <div className="relative w-full min-w-0 max-w-full rounded-md border border-gray-300 bg-white">
                  <table className="w-full min-w-0 table-fixed border-collapse text-xs">
                    <colgroup>
                      <col style={{ width: '32%' }} />
                      <col style={{ width: '38%' }} />
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '15%' }} />
                    </colgroup>
                    <thead className="text-left text-gray-500">
                      <tr>
                        <th
                          scope="col"
                          className="sticky top-0 z-[100] border border-gray-300 border-b-2 border-b-gray-400 bg-gray-100 py-2 px-2 text-[11px] font-medium text-gray-700 shadow-[0_2px_6px_rgba(15,23,42,0.12)] sm:py-2.5 sm:px-3"
                        >
                          Module
                        </th>
                        <th
                          scope="col"
                          className="sticky top-0 z-[100] border border-gray-300 border-b-2 border-b-gray-400 bg-gray-100 py-2 px-2 text-[11px] font-medium text-gray-700 shadow-[0_2px_6px_rgba(15,23,42,0.12)] sm:py-2.5 sm:px-3"
                        >
                          Parameter
                        </th>
                        <th
                          scope="col"
                          className="sticky top-0 z-[100] border border-gray-300 border-b-2 border-b-gray-400 bg-gray-100 py-2 px-2 text-right text-[11px] font-medium text-gray-700 shadow-[0_2px_6px_rgba(15,23,42,0.12)] sm:py-2.5 sm:px-3"
                        >
                          Score
                        </th>
                        <th
                          scope="col"
                          className="sticky top-0 z-[100] border border-gray-300 border-b-2 border-b-gray-400 bg-gray-100 py-2 px-2 text-right text-[11px] font-medium text-gray-700 shadow-[0_2px_6px_rgba(15,23,42,0.12)] sm:py-2.5 sm:px-3"
                        >
                          Weightage
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasNestedRows.map((mod: any, mi: number) => {
                        const modKey = `tas-mod-${mi}`;
                        const lineItems = Array.isArray(mod.results) ? mod.results : [];
                        const hasChildren = lineItems.length > 0;
                        const expanded = tasSheetExpanded.has(modKey);
                        const ms = Number(mod.score) || 0;
                        const mw = Number(mod.weightage) || 0;
                        return (
                          <React.Fragment key={modKey}>
                            <tr className="relative z-0 bg-gray-50">
                              <td className="min-w-0 border border-gray-300 py-2 px-2 align-top sm:px-3">
                                <div className="flex items-start gap-1.5 sm:gap-2">
                                  {hasChildren ? (
                                    <button
                                      type="button"
                                      onClick={() => toggleTasModuleRow(modKey)}
                                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gray-500 bg-white text-gray-800 shadow-sm hover:bg-gray-50"
                                      aria-expanded={expanded}
                                      aria-label={expanded ? 'Collapse module' : 'Expand module'}
                                    >
                                      {expanded ? (
                                        <Minus className="h-3 w-3" strokeWidth={2.5} />
                                      ) : (
                                        <Plus className="h-3 w-3" strokeWidth={2.5} />
                                      )}
                                    </button>
                                  ) : (
                                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0" aria-hidden />
                                  )}
                                  <span className="min-w-0 flex-1 break-words font-normal leading-snug text-gray-500">
                                    {mod.name ?? '—'}
                                  </span>
                                </div>
                              </td>
                              <td className="min-w-0 border border-gray-300 py-2 px-2 text-gray-400 sm:px-3"> </td>
                              <td className="border border-gray-300 py-2 px-2 text-right tabular-nums font-normal text-green-600 sm:px-3">
                                {ms.toFixed(2)}
                              </td>
                              <td className="border border-gray-300 py-2 px-2 text-right tabular-nums font-normal text-gray-700 sm:px-3">
                                {formatWeightageDisplay(mw)}
                              </td>
                            </tr>
                            {expanded &&
                              lineItems.map((line: any, li: number) => {
                                const ls = Number(line.score) || 0;
                                const lw = Number(line.weightage) || 0;
                                return (
                                  <tr key={`${modKey}-line-${li}`} className="relative z-0 cursor-default bg-white">
                                    <td className="min-w-0 border border-gray-300 py-1.5 px-2 sm:px-3" />
                                    <td className="min-w-0 border border-gray-300 py-1.5 px-2 pl-3 text-left break-words font-normal leading-snug text-gray-700 sm:px-3 sm:pl-4">
                                      {line.name ?? '—'}
                                    </td>
                                    <td className="border border-gray-300 py-1.5 px-2 text-right tabular-nums font-normal text-green-600 sm:px-3">
                                      {ls.toFixed(2)}
                                    </td>
                                    <td className="border border-gray-300 py-1.5 px-2 text-right tabular-nums font-normal text-gray-700 sm:px-3">
                                      {formatWeightageDisplay(lw)}
                                    </td>
                                  </tr>
                                );
                              })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
};

export default TASScoreCard;
