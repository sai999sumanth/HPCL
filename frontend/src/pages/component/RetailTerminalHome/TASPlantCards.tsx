import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '@/@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/@/components/ui/dialog';
import { apiClient } from '@/services/apiClient';
import useAuthStore from '@/store/authStore';
import { cn } from '@/@/lib/utils';
import { Info, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/@/components/ui/tooltip';

/** First non-empty zone / SAP from session — same as Terminal Home / `TASScoreCard`. */
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

/** Radix Tooltip opens on focus; dialog auto-focus was landing on the first Info button and showing a tooltip. */
function handleDialogOpenAutoFocus(e: Event) {
  e.preventDefault();
  (e.currentTarget as HTMLElement).focus();
}

interface TASPlantCardsProps {
  onCardClick?: (section: string) => void;
  activeFilters?: { key: string; cond: string; value: string }[];
  crossFilters?: { key: string; cond: string; value: string }[];
  /** Same as TASScoreCard / TAS home — zone id and plant sap_id from ZonePlantSelections. */
  locationFilter?: { zone?: string | null; plant?: string | null };
}

/** Resolve human-readable plant name for `tas_analytics` `location_name` (same contract as FireEngine `useTasPlantLocationName`). */
async function resolveLocationNameForTas(zone: string, sapId: string): Promise<string> {
  const s = sapId.trim();
  if (!s) return '';
  const z = zone.trim();
  try {
    const response = await apiClient.post('/api/ticketing/get_location_data', {
      bu: ['TAS'],
      zone: z ? [z] : [''],
      region: [''],
      sales_area: [''],
      sap_id: [''],
    });
    const locations = response?.data?.data?.locations;
    const found = Array.isArray(locations)
      ? locations.find((loc: { sap_id?: string }) => String(loc?.sap_id) === String(s))
      : undefined;
    const raw = found?.name != null ? String(found.name).trim() : '';
    return raw;
  } catch {
    return '';
  }
}

const PRIMARY_BLUE = "#5D8BF4";
const BLUE_LIGHT = "#C9DBFC";
const BLUE_BORDER = "#DBEAFE";
/** Progress bar unfilled track — grey so the blue fill shows partial width */
const BAR_TRACK_GREY = "#E5E7EB";

const TASPlantCards: React.FC<TASPlantCardsProps> = ({
  onCardClick = () => {},
  activeFilters = [],
  crossFilters = [],
  locationFilter,
}) => {
  const user = useAuthStore((s) => s.user);
  const sessionZone = useMemo(() => firstUserScopeToken(user?.zone), [user?.zone]);
  const sessionSap = useMemo(() => firstUserScopeToken(user?.sap_id), [user?.sap_id]);

  const [isConnDialogOpen, setIsConnDialogOpen] = useState(false);
  const [connectionRows, setConnectionRows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlantStatusDialogOpen, setIsPlantStatusDialogOpen] = useState(false);
  const [plantStatusData, setPlantStatusData] = useState<any[]>([]);
  const [availableCount, setAvailableCount] = useState<number>(0);
  const [totalPlantCount, setTotalPlantCount] = useState<number>(0);

  // ── Plant Connection Status Dialog Table (ORIGINAL) ─────────────────────────
  const PlantStatusTable = () => (
    <TooltipProvider delayDuration={200}>
      {!connectionRows || connectionRows.length === 0 ? (
        <div className="w-full">
          <div className="px-4 pt-4">
            <h2 className="text-lg font-semibold text-gray-800">Plant Connection Status</h2>
          </div>
          <div className="max-h-[70vh] overflow-auto border rounded-md mx-1">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b text-gray-700">
                <tr>
                  <th className="px-4 py-1 w-30">SL. NO.</th>
                  <th className="px-4 py-1">PLANT NAME</th>
                  <th className="px-4 py-1 w-24">ZONE</th>
                  <th className="px-4 py-1 w-40">STATUS</th>
                  <th className="px-4 py-1 w-48">LAST CONNECTED</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-1 text-gray-700">
                      <span className="inline-block w-6 h-3 bg-gray-200 rounded animate-pulse" />
                    </td>
                    <td className="px-4 py-1 text-gray-800">
                      <span className="inline-block w-48 h-3 bg-gray-200 rounded animate-pulse" />
                    </td>
                    <td className="px-4 py-1 text-gray-700">
                      <span className="inline-block w-10 h-3 bg-gray-200 rounded animate-pulse" />
                    </td>
                    <td className="px-4 py-1">
                      <div className="inline-flex items-center gap-2">
                        <span className="inline-flex items-center justify-center text-xs font-semibold px-3 py-1 rounded-md bg-gray-200 text-gray-700">
                          <span className="inline-block w-6 text-center animate-pulse">...</span>
                        </span>
                        <span className="inline-block h-4 w-4 rounded-full bg-gray-200 animate-pulse" />
                      </div>
                    </td>
                    <td className="px-4 py-1 text-gray-700">
                      <span className="inline-block w-32 h-3 bg-gray-200 rounded animate-pulse" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
      <div className="w-full">
        <div className="px-4 pt-4">
          <h2 className="text-lg font-semibold text-gray-800">Plant Connection Status</h2>
        </div>
        <div className="max-h-[70vh] overflow-auto border rounded-md mx-1">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-gray-50 border-b text-gray-700">
              <tr>
                <th className="px-4 py-1 w-30">SL. NO.</th>
                <th className="px-4 py-1">PLANT NAME</th>
                <th className="px-4 py-1 w-24">ZONE</th>
                <th className="px-4 py-1 w-40">STATUS</th>
                <th className="px-4 py-1 w-48">LAST CONNECTED</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {connectionRows.map((row: any, idx: number) => (
                <tr key={row.sap_id || idx} className="hover:bg-gray-50">
                  <td className="px-4 py-1 text-gray-700">{idx + 1}</td>
                  <td className="px-4 py-1 text-gray-800">{row.name}</td>
                  <td className="px-4 py-1 text-gray-700 tabular-nums">
                    {row.loading ? '...' : row.zone || '—'}
                  </td>
                  <td className="px-4 py-1">
                    <div className="inline-flex max-w-full flex-wrap items-center gap-1.5">
                      {row.loading ? (
                        <span className="inline-flex items-center gap-2 justify-center text-xs font-semibold px-3 py-1 rounded-md bg-gray-200 text-gray-700">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Pending</span>
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center justify-center text-xs font-semibold px-3 py-1 rounded-md ${
                            (row.status || '').toString().toLowerCase() === 'live'
                              ? 'bg-green-100 text-green-700'
                              : (row.status || '').toString().toLowerCase() === 'down'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-50 text-yellow-700'
                          }`}
                        >
                          {(row.status || '').toString() || '-'}
                        </span>
                      )}
                      {!row.loading && row.description?.trim() ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex shrink-0 rounded-full p-0.5 text-slate-400 transition-colors hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                              aria-label="View description"
                            >
                              <Info className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            align="start"
                            sideOffset={8}
                            className={cn(
                              "z-[99999999] max-h-[min(85vh,28rem)] max-w-[28rem] overflow-y-auto overflow-x-hidden",
                              "whitespace-normal break-words [overflow-wrap:anywhere]",
                              "rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-normal leading-relaxed text-slate-800 shadow-lg",
                              "!overflow-x-hidden"
                            )}
                          >
                            <p className="m-0 whitespace-pre-wrap break-words">{row.description.trim()}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-1 text-gray-700 whitespace-nowrap">
                    {row.loading ? '...' : row.last_ts_utc ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </TooltipProvider>
  );

  // ── Data Fetching ───────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchCardData = async () => {
      try {
        setIsLoading(true);
        const today = new Date().toISOString().slice(0, 10);
        const zoneFromUi = String(locationFilter?.zone ?? '').trim();
        const sapFromUi = String(locationFilter?.plant ?? '').trim();
        const zone = zoneFromUi || sessionZone;
        const sapId = sapFromUi || sessionSap;
        const location_name = await resolveLocationNameForTas(zone, sapId);
        const response = await apiClient.post('/api/tasanalytics/tas_analytics', {
          analytical_model: 'Run Daily Data Check',
          location_name,
          interlock_name: '',
          alert_status: '',
          alert_severity: [],
          zone,
          start_date: today,
          end_date: today,
          equipment_type: '',
          equipment_name: '',
          download: '',
          top_n: 0,
        });
        const data = response?.data || {};
        const total = data?.total_devices ?? 0;
        const live = data?.live_devices ?? 0;
        const devices = Array.isArray(data?.devices) ? data.devices : [];
        setPlantStatusData(
          devices.map((d: any) => {
            const desc =
              d?.Description != null && String(d.Description).trim() !== ''
                ? String(d.Description).trim()
                : d?.description != null && String(d.description).trim() !== ''
                  ? String(d.description).trim()
                  : '';
            return {
              device_name: d?.device_name ?? '-',
              zone:
                d?.zone != null && String(d.zone).trim() !== '' ? String(d.zone).trim() : '—',
              status: d?.status,
              data_status: d?.status,
              description: desc,
            };
          })
        );
        setTotalPlantCount(total);
        setAvailableCount(live);
      } catch (error) {
        console.error('Error fetching card data:', error);
        setPlantStatusData([]);
        setAvailableCount(0);
        setTotalPlantCount(0);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCardData();
  }, [activeFilters, crossFilters, locationFilter?.zone, locationFilter?.plant, sessionZone, sessionSap]);

  useEffect(() => {
    if (!isConnDialogOpen) return;
    let revealTimeouts: ReturnType<typeof setTimeout>[] = [];
    const fetchConnectionStatus = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const zoneFromUi = String(locationFilter?.zone ?? '').trim();
        const sapFromUi = String(locationFilter?.plant ?? '').trim();
        const zone = zoneFromUi || sessionZone;
        const sapId = sapFromUi || sessionSap;
        const location_name = await resolveLocationNameForTas(zone, sapId);
        const masterResp = await apiClient.post('/api/tasanalytics/tas_analytics', {
          analytical_model: 'Run Daily Data Check',
          location_name,
          interlock_name: '',
          alert_status: '',
          alert_severity: [],
          zone,
          start_date: today,
          end_date: today,
          equipment_type: '',
          equipment_name: '',
          download: '',
          top_n: 0,
        });
        const data = masterResp?.data || {};
        const devices = Array.isArray(data?.devices) ? data.devices : [];
        const resolved = devices.map((d: any) => {
          const desc =
            d?.Description != null && String(d.Description).trim() !== ''
              ? String(d.Description).trim()
              : d?.description != null && String(d.description).trim() !== ''
                ? String(d.description).trim()
                : '';
          return {
            sap_id: String(d?.device_name || ''),
            name: d?.device_name || '-',
            zone: d?.zone != null && String(d.zone).trim() !== '' ? String(d.zone).trim() : '—',
            status: String(d?.status || '').toUpperCase(),
            description: desc,
            latency: '-',
            last_ts_utc: d?.last_ts_utc ?? '-',
            loading: true,
          };
        });
        setConnectionRows(resolved);
        const t = setTimeout(() => {
          setConnectionRows((prev) => prev.map((row) => ({ ...row, loading: false })));
        }, 1000);
        revealTimeouts.push(t);
      } catch (e) {
        console.error('Error checking connections:', e);
        setConnectionRows([]);
      }
    };
    fetchConnectionStatus();
    return () => {
      revealTimeouts.forEach((t) => clearTimeout(t));
    };
  }, [isConnDialogOpen, locationFilter?.zone, locationFilter?.plant, sessionZone, sessionSap]);

  const progressPct =
    !isLoading && totalPlantCount > 0 ? (availableCount / totalPlantCount) * 100 : 0;

  return (
    <>
      <div className="flex h-full min-h-0 w-full max-w-[1800px] flex-col p-0 mx-auto font-sans">
        <Card
          className="flex h-full min-h-[278px] w-full flex-col justify-between overflow-hidden rounded-2xl border bg-white px-6 py-5 transition-shadow duration-200 hover:shadow-md"
          style={{ borderColor: BLUE_BORDER, boxShadow: '0 1px 4px rgba(93,139,244,0.10)' }}
        >
          {/* ── Top section ───────────────────────────────────────── */}
          <div className="flex flex-col">

            <button
              className="group w-full text-left focus:outline-none"
              onClick={() => setIsConnDialogOpen(true)}
              title="View connection status"
            >
              {isLoading ? (
                <div className="flex items-center gap-2 text-slate-300 h-14">
                  <Loader2 className="h-9 w-7 animate-spin" style={{ color: BLUE_BORDER }} />
                  <span className="text-sm font-medium text-slate-400">Loading…</span>
                </div>
              ) : (
                <div className="mb-4">
                  {/* No bordered/bg panel — label + count + thin blue accent only */}
                  <div className="flex gap-2.5">
                    {/* <div className="w-0.5 shrink-0 self-stretch rounded-full" style={{ background: PRIMARY_BLUE }} /> */}
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p className="select-none text-[15px] font-semibold  tracking-wide text-black">
                        Total Active Plants
                      </p>
                      <p
                        className="tabular-nums leading-none"
                        style={{
                          color: PRIMARY_BLUE,
                          fontSize: "40px",
                          fontWeight: 600,
                          lineHeight: 1,
                          letterSpacing: "-0.04em",
                        }}
                      >
                        {totalPlantCount.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* CTA hint */}
              <div className="flex items-center gap-1 mt-1">
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="4.5" stroke="#94A3B8" strokeWidth="1.2" />
                  <path d="M6 4v2.5M6 8v.5" stroke="#94A3B8" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                <p className="text-[10px] font-semibold text-slate-400 group-hover:text-slate-600 transition-colors">
                  Check connection status (click here)
                </p>
              </div>
            </button>
          </div>

          {/* ── Bottom: availability count + progress bar ─────────── */}
          <div className="mt-auto">
            {/* "Available Plant Data" label */}
            <div className="flex items-center gap-1.5 mb-5">
              {/* <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: PRIMARY_BLUE}}
              /> */}
              <p className="select-none text-[15px] font-semibold   text-black-600  tracking-wide">
                Available Plant Data
              </p>
            </div>
            {isLoading ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: BLUE_BORDER }} />
                  <span className="text-xs font-medium text-slate-400">Loading availability…</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 animate-pulse" />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline gap-1.5">
                    <button
                      className="tabular-nums leading-none focus:outline-none transition-opacity hover:opacity-75"
                      style={{
                        fontSize: "26px",
                        fontWeight: 600,
                        color: PRIMARY_BLUE,
                        letterSpacing: "-0.02em",
                      }}
                      onClick={() => setIsPlantStatusDialogOpen(true)}
                    >
                      {availableCount}
                    </button>
                    <span
                      className="text-xs font-bold uppercase tracking-wide"
                      style={{ color: '#94A3B8' }}
                    >
                      / {totalPlantCount} Available
                    </span>
                  </div>

                  {/* Pct badge */}
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full tabular-nums"
                    style={{
                      color: PRIMARY_BLUE,
                      background: BLUE_LIGHT,
                      border: `1px solid ${BLUE_BORDER}`,
                    }}
                  >
                    {progressPct.toFixed(0)}%
                  </span>
                </div>

                {/* Progress bar */}
                <div
                  className="w-full h-2 rounded-full overflow-hidden"
                  style={{ background: BAR_TRACK_GREY }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${progressPct}%`,
                      background: PRIMARY_BLUE,
                      boxShadow: `0 0 6px rgba(93,139,244,0.30)`,
                      transition: 'width 0.9s cubic-bezier(0.34,1.56,0.64,1)',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Connection Status Dialog — ORIGINAL UNCHANGED */}
      <Dialog open={isConnDialogOpen} onOpenChange={setIsConnDialogOpen}>
        <DialogContent
          className="sm:max-w-[1100px] w-full max-h-[85vh]"
          onOpenAutoFocus={handleDialogOpenAutoFocus}
        >
          <PlantStatusTable />
        </DialogContent>
      </Dialog>

      {/* Plant Data Details Dialog */}
      <Dialog open={isPlantStatusDialogOpen} onOpenChange={setIsPlantStatusDialogOpen}>
        <DialogContent
          className="sm:max-w-[1100px] w-full max-h-[85vh] overflow-hidden"
          onOpenAutoFocus={handleDialogOpenAutoFocus}
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-800">Plant Data Details</DialogTitle>
          </DialogHeader>
          <TooltipProvider delayDuration={200}>
            <div className="w-full">
              {plantStatusData.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">No data available</p>
                </div>
              ) : (
                <div className="max-h-[70vh] overflow-auto border rounded-md mx-1">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-gray-50 border-b text-gray-700">
                      <tr>
                        {Object.keys(plantStatusData[0])
                          .filter((key) => key.toLowerCase() !== 'description')
                          .map((key) => (
                            <th key={key} className="px-4 py-1 text-left">
                              {key.toLowerCase() === 'device_name'
                                ? 'PLANT NAME'
                                : key.replace(/_/g, ' ').toUpperCase()}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {plantStatusData.map((row: any, index: number) => (
                        <tr key={index} className="hover:bg-gray-50">
                          {Object.entries(row)
                            .filter(([k]) => k.toLowerCase() !== 'description')
                            .map(([key, value]: [string, any], colIndex: number) => {
                              const isDataStatusColumn = key.toLowerCase() === 'data_status';
                              const isStatusColumn = key.toLowerCase() === 'status';
                              const isPlantName = key.toLowerCase() === 'device_name';
                              const isZone = key.toLowerCase() === 'zone';
                              const cellValue = value != null ? String(value) : '-';
                              let displayValue = cellValue;
                              let badgeClass = '';
                              let dataStatusClass = '';
                              const lower = cellValue.toLowerCase();

                              if (isDataStatusColumn) {
                                if (['live', 'connected', 'up', 'available'].includes(lower)) {
                                  dataStatusClass = 'text-green-600 font-semibold';
                                  displayValue = 'Available';
                                } else {
                                  dataStatusClass = 'text-red-600 font-semibold';
                                  displayValue = 'Not Available';
                                }
                              } else if (isStatusColumn) {
                                if (lower === 'live') badgeClass = 'bg-green-100 text-green-700';
                                else if (lower === 'down') badgeClass = 'bg-red-100 text-red-700';
                                else badgeClass = 'bg-yellow-50 text-yellow-700';
                              }

                              const desc =
                                row.description != null && String(row.description).trim() !== ''
                                  ? String(row.description).trim()
                                  : '';

                              const tdText =
                                isPlantName ? 'text-gray-800' : isZone ? 'text-gray-700 tabular-nums' : 'text-gray-700';

                              return (
                                <td
                                  key={colIndex}
                                  className={`px-4 py-1 ${tdText} ${dataStatusClass}`}
                                >
                                  {badgeClass && isStatusColumn ? (
                                    <div className="inline-flex max-w-full flex-wrap items-center gap-1.5">
                                      <span
                                        className={`inline-flex items-center justify-center text-xs font-semibold px-3 py-1 rounded-md ${badgeClass}`}
                                      >
                                        {displayValue}
                                      </span>
                                      {desc ? (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              type="button"
                                              className="inline-flex shrink-0 rounded-full p-0.5 text-slate-400 transition-colors hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                                              aria-label="View description"
                                            >
                                              <Info className="h-4 w-4" />
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent
                                            side="top"
                                            align="start"
                                            sideOffset={8}
                                            className={cn(
                                              "z-[99999999] max-h-[min(85vh,28rem)] max-w-[28rem] overflow-y-auto overflow-x-hidden",
                                              "whitespace-normal break-words [overflow-wrap:anywhere]",
                                              "rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-normal leading-relaxed text-slate-800 shadow-lg",
                                              "!overflow-x-hidden"
                                            )}
                                          >
                                            <p className="m-0 whitespace-pre-wrap break-words">{desc}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      ) : null}
                                    </div>
                                  ) : (
                                    displayValue
                                  )}
                                </td>
                              );
                            })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TooltipProvider>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TASPlantCards;