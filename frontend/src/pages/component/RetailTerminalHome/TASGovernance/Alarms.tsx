import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Info, Check, ChevronDown, X } from 'lucide-react';
import { apiClient } from "@/services/apiClient";
import { cn } from '@/@/lib/utils';
import { Button } from '@/@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/@/components/ui/popover';

interface PlantOption {
  id: string;
  name: string;
}

interface ZoneOption {
  id: string;
  name: string;
}

interface ViolationData {
  violation: string;
  percentage: number;
  count: number;
}

interface AlarmasProps {
  startDate?: string;
  endDate?: string;
  refreshTrigger?: number;
  onInterlockSelect?: (interlockName: string | null) => void;
  onAlertSeverityChange?: (severities: string[]) => void;
  selectedInterlock?: string | null;
}

const Alarmas: React.FC<AlarmasProps> = ({ startDate, endDate, refreshTrigger = 0, onInterlockSelect, onAlertSeverityChange, selectedInterlock }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<any>(null);
  const [alarmData, setAlarmData] = useState<ViolationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [selectedPlantName, setSelectedPlantName] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [zoneOptions, setZoneOptions] = useState<ZoneOption[]>([]);
  const [plantData, setPlantData] = useState<PlantOption[]>([]);
  const [openZone, setOpenZone] = useState(false);
  const [openPlant, setOpenPlant] = useState(false);
  const SEVERITY_OPTIONS = [
    { id: 'Critical' as const, letter: 'C', color: '#dc2626' },
    { id: 'High' as const, letter: 'H', color: '#ea580c' },
    { id: 'Medium' as const, letter: 'M', color: '#ca8a04' },
    { id: 'Low' as const, letter: 'L', color: '#16a34a' },
  ];
  const [alertSeverity, setAlertSeverity] = useState<string[]>(['Critical']);
  const [selectedSeverityOptions, setSelectedSeverityOptions] = useState<string[]>(['Critical']);

  // Custom color palette with gradients (using only dark colors)
  const GRADIENT_COLORS = [
    // { light: "#93C5FD", dark: "#3b82f6" }, // Commented out - using only dark colors
    { light: "#BF124D", dark: "#BF124D" }, // Dark Red/Magenta
    { light: "#540863", dark: "#540863" }, // Dark Purple
    { light: "#0C2B4E", dark: "#0C2B4E" }, // Dark Blue
    { light: "#556B2F", dark: "#556B2F" }, // Dark Green/Olive
    { light: "#F97A00", dark: "#F97A00" }, // Dark Orange
  ];

  const MATTE_COLORS = [
    "#BF124D", // Dark Red/Magenta
    "#540863", // Dark Purple
    "#0C2B4E", // Dark Blue
    "#556B2F", // Dark Green/Olive
    "#F97A00", // Dark Orange
  ];

  const getColorForIndex = (index: number) => {
    return MATTE_COLORS[index % MATTE_COLORS.length];
  };

  useEffect(() => {
    if (onAlertSeverityChange) {
      onAlertSeverityChange(['']);
    }
  }, []);

  // Fetch zone and plant data (same pattern as equipmentwisedetails / PerformanceScoreBreakdownChart)
  const fetchLocationData = async (zoneFilter: string = '') => {
    try {
      // Old API (commented):
      // const payloadOld = {
      //   bu: ["TAS"],
      //   zone: [""],
      //   region: [""],
      //   sales_area: [""],
      //   sap_id: [""],
      // };
      // const responseOld = await apiClient.post('/api/ticketing/get_location_data', payloadOld);

      const payload = {
        bu: 'TAS',
        zone: zoneFilter || '',
        plant: selectedPlantId ?? '',
        location_onboard: true,
      };
      const response = await apiClient.post('/api/locationmaster/get_dist_loc_details', payload);
      const data = response?.data;
      if (!data || data.status !== true) return;
      const inner = data.data ?? {};

      const zoneList: any[] = Array.isArray(inner.zone) ? inner.zone : [];
      const zonesNormalized: ZoneOption[] = zoneList
        .map((z: any) => {
          const id = String(z?.id ?? z?.name ?? '').trim();
          const name = String(z?.name ?? z?.id ?? '').trim() || id;
          return id ? { id, name } : null;
        })
        .filter(Boolean) as ZoneOption[];
      if (!zoneFilter) setZoneOptions(zonesNormalized);

      const plantList: any[] = Array.isArray(inner.sap_id) ? inner.sap_id : [];
      const plantsNormalized: PlantOption[] = plantList
        .map((p: any) => {
          const id = String(p?.id ?? '').trim();
          const name = String(p?.name ?? '').trim() || id;
          return id ? { id, name } : null;
        })
        .filter(Boolean) as PlantOption[];
      setPlantData(plantsNormalized);
    } catch (error) {
      console.error('Error fetching location data:', error);
      if (!zoneFilter) setZoneOptions([]);
      setPlantData([]);
    }
  };

  useEffect(() => {
    fetchLocationData(selectedZone ?? '');
  }, [selectedZone, selectedPlantId]);

  useEffect(() => {
    const fetchAlarmData = async () => {
      try {
        if (alarmData.length > 0) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
        setError(null);

        const payload = {
          "analytical_model": "Top Repeated Alerts",
          "location_name": selectedPlantName?.toUpperCase() || "",
          "interlock_name": "",
          "alert_status": "",
          "alert_severity": alertSeverity,
          "zone": selectedZone || "",
          "start_date": startDate || new Date().toISOString().split('T')[0],
          "end_date": endDate || new Date().toISOString().split('T')[0]
        };

        const response = await apiClient.post('/api/tasanalytics/tas_analytics', payload);

        if (response && response.data) {
          // const apiData = response.data;
          const apiData = response.data?.data ?? response.data;
          let transformedData: ViolationData[] = [];

          if (Array.isArray(apiData)) {
            const totalCount = apiData.reduce((sum, item) => sum + (item.count || 0), 0);
            transformedData = apiData.map((item, index) => {
              const count = item.count || 0;
              const percentage = totalCount > 0 ? (count / totalCount) * 100 : 0;
              return {
                violation: item.interlock_name || `Alert ${index + 1}`,
                percentage: percentage,
                count: count
              };
            });
          }

          setAlarmData(transformedData);
        }
      } catch (err: any) {
        console.error('Failed to fetch alarm data:', err);
        setError(err?.response?.data?.message || err.message || 'Failed to load alarm data');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    };

    // Debounce filter changes to prevent glitches when selecting fast
    const debounceTimer = setTimeout(() => {
    fetchAlarmData();
    }, 300); // 300ms debounce delay

    return () => clearTimeout(debounceTimer);
  }, [selectedPlantName, selectedZone, startDate, endDate, refreshTrigger, alertSeverity]);

  useEffect(() => {
    if (!chartRef.current || !alarmData || alarmData.length === 0) return;

    // Dynamic import of amCharts
    Promise.all([
      import('@amcharts/amcharts5'),
      import('@amcharts/amcharts5/percent'),
      import('@amcharts/amcharts5/themes/Animated')
    ]).then(([am5Module, am5percentModule, am5themesModule]) => {
      const am5 = am5Module;
      const am5percent = am5percentModule;
      const am5themes_Animated = am5themesModule.default;

      // Dispose of any existing root
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
      if (chartRef.current) {
        const existingRoot = am5.registry.rootElements.find(root => root.dom === chartRef.current);
        if (existingRoot) {
          existingRoot.dispose();
        }
      }

      const root = am5.Root.new(chartRef.current!);
      rootRef.current = root;

      if (root._logo) root._logo.dispose();

      root.setThemes([am5themes_Animated.new(root)]);

      const chart = root.container.children.push(
        am5percent.PieChart.new(root, {
          layout: root.horizontalLayout,
          radius: am5.percent(90),
          paddingTop: 10,
          paddingRight: 10,
          paddingBottom: 10,
          paddingLeft: 10
        })
      );

      const series = chart.series.push(
        am5percent.PieSeries.new(root, {
          alignLabels: false,
          calculateAggregates: true,
          valueField: 'count',
          categoryField: 'violation',
          innerRadius: am5.percent(20)
        })
      );

      series.slices.template.setAll({
        tooltipText: "{category}\ncount:{value}",
        stroke: am5.color(0xffffff),
        strokeWidth: 3,
        cornerRadius: 4
      });

      // Add click event to slices
      series.slices.template.events.on("click", (ev) => {
        const dataItem = ev.target.dataItem;
        if (dataItem && dataItem.dataContext) {
          const violationData = dataItem.dataContext as ViolationData;
          if (violationData && violationData.violation && onInterlockSelect) {
            onInterlockSelect(violationData.violation);

            setTimeout(() => {
              const alertDetailsTable = document.querySelector('[data-alert-details-table]');
              if (alertDetailsTable) {
                alertDetailsTable.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start'
                });
              }
            }, 100);
          }
        }
      });

      // Configure tooltip with dynamic color matching the slice
      const tooltip = am5.Tooltip.new(root, {
        getFillFromSprite: true,
        labelText: "{category}\ncount:{value}",
        paddingTop: 5,
        paddingBottom: 5,
        paddingLeft: 7,
        paddingRight: 7,
        dy: -20,
        centerX: am5.percent(50),
        animationDuration: 150
      });

      // Set small font size for tooltip text with black bold color
      tooltip.label.setAll({
        fontSize: 10,
        fill: am5.color(0x000000),
        fontWeight: "bold"
      });

      series.slices.template.set("tooltip", tooltip);

      // Apply gradient to tooltip background to match the slice
      series.slices.template.events.on("pointerover", (ev) => {
        const dataItem = ev.target.dataItem as any;
        const tooltip = ev.target.get("tooltip");
        if (dataItem && tooltip && root) {
          const index = series.dataItems.indexOf(dataItem);
          const gradientColor = GRADIENT_COLORS[index % GRADIENT_COLORS.length];
          
          // Set tooltip background to match slice gradient
          const background = tooltip.get("background");
          if (background) {
            background.setAll({
              fillGradient: am5.LinearGradient.new(root, {
                stops: [
                  { color: am5.color(gradientColor.light), offset: 0 },
                  { color: am5.color(gradientColor.dark), offset: 1 }
                ]
              }),
          stroke: am5.color(0xffffff),
              strokeWidth: 1,
              fillOpacity: 0.95
            });
          }
        }
      });

      series.slices.template.adapters.add("radius", function (radius, target) {
        const dataItem = target.dataItem;
        const high = series.getPrivate("valueHigh");

        if (dataItem) {
          const dataContext = dataItem?.dataContext as ViolationData | undefined;
          const value = dataContext?.count || 0;
          const minRadius = 0.6;
          const radiusFactor = minRadius + (1 - minRadius) * (value / (high || 1));
          return radius * radiusFactor;
        }
        return radius;
      });

      // Hide labels and ticks on the chart itself
      series.labels.template.setAll({
        visible: false
      });

      series.ticks.template.setAll({
        visible: false
      });

      // Apply gradient fills to slices based on index
      series.slices.template.adapters.add("fillGradient", (fillGradient, target) => {
        const dataItem = target.dataItem as any;
        if (dataItem && root) {
          const index = series.dataItems.indexOf(dataItem);
          const gradientColor = GRADIENT_COLORS[index % GRADIENT_COLORS.length];
          
          return am5.LinearGradient.new(root, {
            stops: [
              { color: am5.color(gradientColor.light), offset: 0 },
              { color: am5.color(gradientColor.dark), offset: 1 }
            ]
          });
        }
        return fillGradient;
      });

      series.data.setAll(alarmData);
      series.appear(1000, 100);
      chart.appear(1000, 100);
    });
    
    // Cleanup function
    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
    };
  }, [alarmData]);

  const toggleSeverity = (severity: string) => {
    let next: string[];
    if (selectedSeverityOptions.includes(severity)) {
      next = selectedSeverityOptions.filter((s) => s !== severity);
      if (next.length === 0) next = ['Critical'];
    } else {
      next = [...selectedSeverityOptions, severity];
    }
    setSelectedSeverityOptions(next);
    const forApi = next.length === 4 ? [''] : next;
    setAlertSeverity(forApi);
    if (onAlertSeverityChange) onAlertSeverityChange(forApi);
  };

  const handleZoneChange = (zoneValue: string) => {
    const zone = zoneValue === '' ? null : zoneValue;
    setSelectedZone(zone);
    setSelectedPlantId(null);
    setSelectedPlantName(null);
  };

  const handlePlantChange = (plantIdValue: string) => {
    const plantId = plantIdValue === '' ? null : plantIdValue;
    setSelectedPlantId(plantId);
    if (plantId && plantData.length > 0) {
      const selectedPlant = plantData.find(plant => plant.id === plantId);
      setSelectedPlantName(selectedPlant ? selectedPlant.name : plantId);
    } else {
      setSelectedPlantName(null);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-white pl-2 pr-2 pt-0 pb-1 relative">
      <div className="flex items-center justify-between mb-3 min-h-[32px] relative z-30">
        <h3 className="text-sm font-semibold text-gray-900">Top 5 Frequently Generated Alarms</h3>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* C H M L toggles (no dropdown, no heading), default all selected */}
          {SEVERITY_OPTIONS.map((opt) => {
            const isSelected = selectedSeverityOptions.includes(opt.id);
            return (
              <div key={opt.id} className="flex items-center gap-2 shrink-0">
                {/* Letter on left */}
                <span className="text-xs font-medium text-gray-700">{opt.letter}</span>
                {/* Checkbox on right */}
                <button
                  type="button"
                  onClick={() => toggleSeverity(opt.id)}
                  className="flex h-5 w-5 items-center justify-center rounded-sm shrink-0 border-2 bg-transparent p-0 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400"
                  style={{ borderColor: opt.color }}
                  aria-pressed={isSelected}
                  title={opt.id}
                >
                  {isSelected ? <Check className="h-3 w-3" strokeWidth={5.5} style={{ color: '#2563eb' }} /> : null}
                </button>
          </div>
            );
          })}
          {/* Zone & Location - reduced width */}
          <Popover open={openZone} onOpenChange={setOpenZone}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openZone}
                className="w-28 min-w-[7rem] h-7 text-xs justify-between px-1.5"
              >
                <span className="truncate">{selectedZone ? (zoneOptions.find((z) => z.id === selectedZone)?.name ?? 'Select Zone') : 'Select Zone'}</span>
                <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 min-w-[10rem] p-0">
              <Command>
                <CommandInput placeholder="Search Zone..." className="h-9" />
                <CommandList>
                  <CommandEmpty>No zone found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem value="all-zones" onSelect={() => { handleZoneChange(''); setOpenZone(false); }}>
                      <Check className={cn('mr-2 h-4 w-4', !selectedZone ? 'opacity-100' : 'opacity-0')} />
                      All Zones
                    </CommandItem>
                    {zoneOptions.map((z) => (
                      <CommandItem
                        key={z.id}
                        value={z.name.toLowerCase()}
                        onSelect={() => { handleZoneChange(z.id); setOpenZone(false); }}
                      >
                        <Check className={cn('mr-2 h-4 w-4', selectedZone === z.id ? 'opacity-100' : 'opacity-0')} />
                        {z.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Popover open={openPlant} onOpenChange={setOpenPlant}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openPlant}
                className="w-28 min-w-[7rem] h-7 text-xs justify-between px-1.5"
              >
                <span className="truncate">{selectedPlantId ? (plantData.find((p) => p.id === selectedPlantId)?.name ?? 'Select Plant') : 'Select Plant'}</span>
                <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 min-w-[10rem] p-0">
              <Command>
                <CommandInput placeholder="Search Plant..." className="h-9" />
                <CommandList>
                  <CommandEmpty>No plant found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem value="all-plants" onSelect={() => { handlePlantChange(''); setOpenPlant(false); }}>
                      <Check className={cn('mr-2 h-4 w-4', !selectedPlantId ? 'opacity-100' : 'opacity-0')} />
                      All Plants
                    </CommandItem>
                    {plantData.map((p) => (
                      <CommandItem
                        key={p.id}
                        value={p.name.toLowerCase()}
                        onSelect={() => { handlePlantChange(p.id); setOpenPlant(false); }}
                      >
                        <Check className={cn('mr-2 h-4 w-4', selectedPlantId === p.id ? 'opacity-100' : 'opacity-0')} />
                        {p.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div className="flex items-center gap-2 -mt-2 text-[10px] ml-1 text-gray-500 leading-none flex-wrap relative z-10 flex-shrink-0">
        <Info className="h-3 w-3 flex-shrink-0" />
        <span>Click on slice or legend to get details in table</span>
        {onInterlockSelect && selectedInterlock && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onInterlockSelect(null);
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onInterlockSelect(null);
            }}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 cursor-pointer touch-manipulation select-none"
            style={{ pointerEvents: 'auto' }}
            title="Close table"
            aria-label="Close table"
          >
            <X className="h-4 w-4 pointer-events-none" />
          </button>
        )}
      </div>
      <div className="flex-1 flex items-center gap-4 relative min-w-0 w-full" style={{ minHeight: 0, zIndex: 0 }}>
        {(isLoading || isRefreshing) && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-20 rounded">
            <div className="text-center">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600">{isLoading ? 'Loading alarm data...' : 'Refreshing data...'}</p>
            </div>
          </div>
        )}
        
        <div
          className="relative aspect-square w-[min(44%,340px)] min-w-[220px] max-w-[380px] shrink-0 overflow-visible py-7"
          style={{
            visibility: (isLoading || isRefreshing) ? 'hidden' : 'visible',
          }}
        >
          {error ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center text-red-500 text-sm">⚠ Data unavailable</div>
            </div>
          ) : (
            <div
              ref={chartRef}
              className="w-full h-full"
              style={{ position: 'relative', zIndex: 1, overflow: 'visible' }}
            />
          )}
        </div>

        <div
          className="min-w-0 flex-1 flex flex-col justify-center space-y-2 overflow-y-auto max-h-full"
          style={{ visibility: (isLoading || isRefreshing) ? 'hidden' : 'visible' }}
        >
          {error ? (
            <div className="text-center text-gray-500 text-sm py-4">
              Failed to load alarm data
            </div>
          ) : alarmData.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-4">
              No alarm data available
            </div>
          ) : (
            alarmData.map((item, index) => {
              const color = getColorForIndex(index);
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    if (item.violation && onInterlockSelect) {
                      onInterlockSelect(item.violation);
                      setTimeout(() => {
                        const alertDetailsTable = document.querySelector('[data-alert-details-table]');
                        if (alertDetailsTable) {
                          alertDetailsTable.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }, 100);
                    }
                  }}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors w-full text-left cursor-pointer"
                >
                  <div
                    className="w-4 h-4 rounded-md flex-shrink-0 mt-0.5 shadow-sm"
                    style={{
                      background: color,
                      boxShadow: `0 2px 4px ${color}40`
                    }}
                  />
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className="text-xs font-medium text-gray-800 break-words leading-tight"
                        title={item.violation}
                      >
                        {item.violation}
                      </span>
                      <span 
                        className="text-xs font-bold flex-shrink-0 px-2 py-0.5 rounded-md"
                        style={{
                          color: color,
                          backgroundColor: `${color}15`
                        }}
                      >
                        {item.count}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Alarmas;