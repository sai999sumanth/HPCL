import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5percent from '@amcharts/amcharts5/percent';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { Loader2, Check, ChevronDown, Info } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
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

interface EquipmentData {
  equipment_type: string;
  critical_count: number;
}

interface PlantOption {
  id: string;
  name: string;
}

interface ZoneOption {
  id: string;
  name: string;
}

interface EquipmentWiseDetailsProps {
  startDate?: string;
  endDate?: string;
  refreshTrigger?: number;
  onEquipmentTypeSelect?: (equipmentType: string) => void;
}

const EquipmentWiseDetails = ({ startDate, endDate, refreshTrigger = 0, onEquipmentTypeSelect }: EquipmentWiseDetailsProps = {}) => {
  const [data, setData] = useState<EquipmentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [legendScrollPosition, setLegendScrollPosition] = useState(0);
  const legendRef = useRef<HTMLDivElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [alertStatus, setAlertStatus] = useState<'Open' | 'Close'>('Open');
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [selectedPlantName, setSelectedPlantName] = useState<string | null>(null);
  const [zoneOptions, setZoneOptions] = useState<ZoneOption[]>([]);
  const [plantData, setPlantData] = useState<PlantOption[]>([]);
  const [sliceColors, setSliceColors] = useState<string[]>([]);
  const [openZone, setOpenZone] = useState(false);
  const [openPlant, setOpenPlant] = useState(false);

  // Color palette - using only dark colors (light colors commented out)
  // const GRADIENT_COLORS_LIGHT = [
  //   { light: "#C4B5FD", dark: "#8b5cf6" }, // Purple (same as Alarms.tsx)
  //   { light: "#F48FB1", dark: "#EC4899" }, // Pink
  //   { light: "#EF9A9A", dark: "#EF5350" }, // Red
  //   { light: "#9575CD", dark: "#5E35B1" }, // Dark Purple
  //   { light: "#64B5F6", dark: "#1E88E5" }, // Dark Blue
  //   { light: "#80DEEA", dark: "#26C6DA" }, // Teal
  //   { light: "#FFB74D", dark: "#F97316" }  // Orange
  // ];

  // Custom color palette with gradients (light to dark for each slice like Topalerts)
  // const GRADIENT_COLORS = [
  //   { light: "#67E8F9", dark: "#00dff0" }, // Cyan/Blue
  //   { light: "#F9A8D4", dark: "#ed3bbd" }, // Pink/Magenta
  //   { light: "#FDBA74", dark: "#ff8d63" }, // Orange
  //   { light: "#FDE047", dark: "#f9f871" }, // Yellow
  //   { light: "#C4B5FD", dark: "#8350e6" }, // Purple
  //   { light: "#FCA5A5", dark: "#f1003b" }, // Red
  // ];

  // const MATTE_COLORS = [
  //   "#00dff0", // Cyan/Blue
  //   "#ed3bbd", // Pink/Magenta
  //   "#ff8d63", // Orange
  //   "#f9f871", // Yellow
  //   "#8350e6", // Purple
  //   "#f1003b", // Red
  // ];

  // const LEGEND_COLORS = [
  //   '#00a2ff', '#f3a200', '#67b7dc', '#e26b6b', '#80c342',
  //   '#a0a0a0', '#ffd966', '#9966ff', '#00cc99', '#ff6699',
  // ];
  const getColorForIndex = (index: number) => {
    if (sliceColors.length > 0 && sliceColors[index]) return sliceColors[index];
    // return LEGEND_COLORS[index % LEGEND_COLORS.length];
  };

  const handleLegendScroll = (direction: 'up' | 'down') => {
    if (!legendRef.current) return;
    const scrollAmount = 40;
    const newPosition = direction === 'up' 
      ? Math.max(0, legendScrollPosition - scrollAmount)
      : Math.min(legendRef.current.scrollHeight - legendRef.current.clientHeight, legendScrollPosition + scrollAmount);
    setLegendScrollPosition(newPosition);
    legendRef.current.scrollTop = newPosition;
  };

  /** Same behavior as pie slice click — notify parent (equipment type for downstream payload). */
  const handleEquipmentTypeSelect = useCallback(
    (equipmentType: string) => {
      if (equipmentType && onEquipmentTypeSelect) {
        onEquipmentTypeSelect(equipmentType);
      }
    },
    [onEquipmentTypeSelect]
  );

  // Fetch zone and plant data
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

    const fetchEquipmentData = async () => {
      try {
        console.log("fetchEquipmentData called with selectedZone:", selectedZone, "selectedPlantName:", selectedPlantName);
        setIsLoading(true);
        setError(null);

        const payload = {
          "analytical_model": "Critical Alerts By Equipment",
          "location_name": selectedPlantName?.toUpperCase() || "",
          "interlock_name": "",
          "alert_status": alertStatus,
          "alert_severity": [],
          "zone": selectedZone || "",
          "start_date": startDate || new Date().toISOString().split('T')[0],
          "end_date": endDate || new Date().toISOString().split('T')[0],
          "equipment_type": "",
          "equipment_name": "",
          "download": ""
        };

        console.log("Payload being sent:", payload);

        const response = await apiClient.post('/api/tasanalytics/tas_analytics', payload);

        if (response && response.data) {
          const apiData = response.data?.data ?? response.data;
          let dataArray: EquipmentData[] = [];

          if (Array.isArray(apiData)) {
            dataArray = apiData;
          } else if (typeof apiData === 'object' && apiData !== null) {
            dataArray = Object.values(apiData);
          }

          setData(dataArray);
        } else {
          setError('No data available');
          setData([]);
        }
      } catch (err: any) {
        console.error('Error fetching equipment data:', err);
        setError(err?.response?.data?.message || err.message || 'Failed to fetch equipment data');
        setData([]);
      } finally {
        setIsLoading(false);
      }
    };

  useEffect(() => {
    fetchEquipmentData();
  }, [startDate, endDate, refreshTrigger, alertStatus, selectedZone, selectedPlantName]);

  // const handleLegendClick = (equipmentType: string) => {
  //   if (selectedCategory === equipmentType) {
  //     // If clicking the same category, deselect it
  //     setSelectedCategory(null);
  //     // Clear equipment type selection in parent
  //     if (onEquipmentTypeSelect) {
  //       onEquipmentTypeSelect("");
  //     }
  //   } else {
  //     // Select the clicked category
  //     setSelectedCategory(equipmentType);
  //     // Pass equipment type to parent for locatiowisedetails
  //     if (onEquipmentTypeSelect) {
  //       onEquipmentTypeSelect(equipmentType);
  //     }
  //   }
  // };

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

  // Filter data based on selected category
  const filteredData = selectedCategory 
    ? data.filter(item => item.equipment_type === selectedCategory)
    : data;

  // Initialize amcharts pie chart
  useEffect(() => {
    if (!chartRef.current || filteredData.length === 0) return;

    // Dispose of any existing chart
    if (chartRef.current) {
      const existingRoot = am5.registry.rootElements.find(root => root.dom === chartRef.current);
      if (existingRoot) {
        existingRoot.dispose();
      }
    }

    // Create root element
    const root = am5.Root.new(chartRef.current);

    // Set themes
    root.setThemes([am5themes_Animated.new(root)]);

    // Hide logo
    root._logo?.dispose();

    // Create pie chart with inner radius (donut chart)
    const chart = root.container.children.push(
      am5percent.PieChart.new(root, {
        layout: root.horizontalLayout,
        innerRadius: am5.percent(45),
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 0,
      })
    );

    // Create series
    const series = chart.series.push(
      am5percent.PieSeries.new(root, {
        valueField: "critical_count",
        categoryField: "equipment_type",
        alignLabels: false,
      })
    );

    // Hide labels and ticks (label lines) on pie slices
    series.labels.template.setAll({
      text: "",
      fontSize: 0,
      forceHidden: true,
    });

    series.ticks.template.setAll({
      visible: false,
      forceHidden: true,
    });

    // Configure tooltip
    series.slices.template.setAll({
      strokeWidth: 2,
      stroke: am5.color(0xffffff),
      tooltipText: "{category}: {value} ({valuePercentTotal.formatNumber('0.00')}%)",
    });

    series.slices.template.states.create("hover", {
      scale: 1.05,
    });

    // Add click event to slices (same handler as legend)
    series.slices.template.events.on("click", (ev) => {
      const dataItem = ev.target.dataItem;
      if (dataItem && dataItem.dataContext) {
        const equipmentType = (dataItem.dataContext as EquipmentData).equipment_type;
        handleEquipmentTypeSelect(equipmentType);
      }
    });

    // Set data - let amCharts use default colors
    series.data.setAll(filteredData);

    // Make stuff animate on load
    series.appear(1000, 100);
    chart.appear(1000, 100);
    
    // Wait for chart to render, then extract colors from slices to match legend
    setTimeout(() => {
      const colors: string[] = [];
      for (let i = 0; i < series.dataItems.length; i++) {
        const dataItem = series.dataItems[i];
        const slice = dataItem.get("slice");
        if (slice) {
          const fill = slice.get("fill");
          if (fill) {
            try {
              const color = fill.toCSSHex();
              colors[i] = color;
            } catch (e) {
              // Fallback if toCSSHex doesn't work
              const colorValue = fill.toString();
              colors[i] = colorValue;
            }
          }
        }
      }
      if (colors.length > 0) {
        setSliceColors(colors);
      }
    }, 1200);

    return () => {
      root.dispose();
    };
  }, [filteredData, handleEquipmentTypeSelect]);

  return (
    <>
      <div className="mb-1 ml-1">
        <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-800"> Critical alarms-Equipment wise breakup</h3>
        <div className="flex items-center gap-3">
          {/* Alert Status Toggle - dark pink-red / dark green */}
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold ${alertStatus === 'Open' ? 'text-red-700' : 'text-green-700'}`}>
              {alertStatus}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={alertStatus === 'Open'}
              onClick={() => {
                setAlertStatus(alertStatus === 'Open' ? 'Close' : 'Open');
              }}
              className={`relative inline-flex h-6 w-12 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 shadow-sm ${
                alertStatus === 'Open'
                  ? 'bg-red-700 focus:ring-red-600 border border-red-800'
                  : 'bg-green-700 focus:ring-green-600 border border-green-800'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                  alertStatus === 'Open' ? 'translate-x-7' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Popover open={openZone} onOpenChange={setOpenZone}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openZone}
                  className="w-28 min-w-[7rem] h-7 text-xs justify-between"
                >
                  {selectedZone
                    ? (zoneOptions.find((z) => z.id === selectedZone)?.name ?? 'Select Zone')
                    : 'Select Zone'}
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-42 p-0">
                <Command>
                  <CommandInput placeholder="Search Zone..." className="h-9" />
                  <CommandList>
                    <CommandEmpty>No zone found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all-zones"
                        onSelect={() => {
                          handleZoneChange('');
                          setOpenZone(false);
                        }}
                      >
                        <Check className={cn('mr-2 h-4 w-4', !selectedZone ? 'opacity-100' : 'opacity-0')} />
                        All Zones
                      </CommandItem>
                      {zoneOptions.map((z) => (
                        <CommandItem
                          key={z.id}
                          value={z.name.toLowerCase()}
                          onSelect={() => {
                            handleZoneChange(z.id);
                            setOpenZone(false);
                          }}
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
                  title={
                    selectedPlantId
                      ? (plantData.find((p) => p.id === selectedPlantId)?.name ?? '')
                      : undefined
                  }
                  className="h-7 w-28 min-w-[7rem] max-w-[7rem] shrink-0 gap-1 px-2 text-xs justify-between overflow-hidden"
                >
                  <span className="block min-w-0 flex-1 truncate text-left">
                    {selectedPlantId
                      ? (plantData.find((p) => p.id === selectedPlantId)?.name ?? 'Select Plant')
                      : 'Select Plant'}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-42 p-0">
                <Command>
                  <CommandInput placeholder="Search Plant..." className="h-9" />
                  <CommandList>
                    <CommandEmpty>No plant found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all-plants"
                        onSelect={() => {
                          handlePlantChange('');
                          setOpenPlant(false);
                        }}
                      >
                        <Check className={cn('mr-2 h-4 w-4', !selectedPlantId ? 'opacity-100' : 'opacity-0')} />
                        All Plants
                      </CommandItem>
                      {plantData.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={p.name.toLowerCase()}
                          onSelect={() => {
                            handlePlantChange(p.id);
                            setOpenPlant(false);
                          }}
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
          {selectedCategory && (
            <button
              onClick={() => {
                setSelectedCategory(null);
                // Clear equipment type selection in parent
                if (onEquipmentTypeSelect) {
                  onEquipmentTypeSelect("");
                }
              }}
              className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Back to All
            </button>
          )}
        </div>
        </div>
        <div className="flex items-start gap-1 mt-1 pr-2 max-w-[min(100%,42rem)] text-[10px] text-gray-500 leading-snug">
          <Info className="h-3 w-3 shrink-0 mt-0.5 text-gray-400" aria-hidden />
          <span>
            Click a chart slice or a legend item to load data into the Location-wise Critical bar chart.
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="w-full flex justify-center items-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" style={{ color: '#6366f1' }} />
            <p className="text-sm text-gray-600">Loading equipment data...</p>
          </div>
        </div>
      ) : error ? (
        <div className="w-full flex justify-center items-center py-12">
          <div className="text-center">
            <div className="text-red-500 text-sm">⚠ {error}</div>
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="w-full flex justify-center items-center py-12">
          <div className="text-center">
            <div className="text-gray-500 text-sm">No equipment data available</div>
          </div>
        </div>
      ) : (
      <div
        className="flex items-center gap-4 mt-2 min-w-0 w-full"
        style={{ minHeight: 0, maxHeight: '350px', overflow: 'hidden' }}
      >
        {/* Chart container — grows on wide screens */}
        <div
          className="relative mt-2.5 aspect-square w-[min(42%,320px)] min-w-[200px] max-w-[360px] shrink-0 overflow-hidden"
        >
          <div
            ref={chartRef}
            className="absolute inset-0 h-full w-full"
            style={{ zIndex: 1, overflow: 'hidden' }}
          />
        </div>

        {/* Legend - custom HTML like Alarms.tsx */}
        <div className={`min-w-0 flex-1 flex flex-col relative ${data.length <= 4 ? 'justify-center' : ''}`} style={{ height: '260px', overflow: 'hidden' }}>
          {data.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-4">
              No equipment data available
            </div>
          ) : (
            <>
              {/* Scroll arrows if more than 4 items */}
              {data.length > 4 && (
                <button
                  onClick={() => handleLegendScroll('up')}
                  className="absolute top-0 right-0 z-10 p-1 text-gray-600 hover:text-gray-800"
                  style={{ transform: 'translateY(-100%)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
                  </svg>
                </button>
              )}
              
              <div 
                ref={legendRef}
                className={`flex flex-col space-y-1 ${data.length > 4 ? 'overflow-y-auto' : ''}`}
        style={{
                  height: data.length <= 4 ? 'auto' : '260px',
                  paddingRight: data.length > 4 ? '20px' : '0',
          width: '100%',
                }}
              >
                {data.map((item, index) => {
                  const color = getColorForIndex(index);
                  const isSelected = selectedCategory === item.equipment_type;
                  return (
                    <div 
                      key={index} 
                      role="button"
                      tabIndex={0}
                      onClick={() => handleEquipmentTypeSelect(item.equipment_type)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleEquipmentTypeSelect(item.equipment_type);
                        }
                      }}
                      className={`flex items-center gap-2 py-1 px-2 rounded-lg cursor-pointer transition-colors ${
                        isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div
                        className="w-4 h-4 rounded-sm flex-shrink-0"
                        style={{
                          background: color
                        }}
                      />
                      <span
                        className="text-xs font-medium text-gray-700 leading-tight flex-1"
                        title={item.equipment_type}
                      >
                        {item.equipment_type}
                      </span>
                      <span 
                        className="text-xs font-bold flex-shrink-0 ml-2 px-2 py-0.5 rounded-md"
                        style={{
                          color: color,
                          backgroundColor: `${color}15`
                        }}
                      >
                        {item.critical_count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
      )}
    </>
  );
};

export default EquipmentWiseDetails;