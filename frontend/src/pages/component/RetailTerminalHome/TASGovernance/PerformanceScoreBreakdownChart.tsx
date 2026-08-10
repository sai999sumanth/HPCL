import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/@/components/ui/sheet';
import { apiClient } from '@/services/apiClient';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { Loader2, ChevronDown, X, Info, Plus, Minus, Check } from 'lucide-react';
import { Button } from "@/@/components/ui/button";
import { cn } from '@/@/lib/utils';
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

// Color from MATTE_COLORS palette
const CHART_COLOR = "#0998be"; // Teal (original color)

// API scores are on scale of 20; normalize to 100 for display (e.g. 15.83/20 -> 79.15/100)
const SCORE_SCALE_MAX = 20;
const normalizeScore20To100 = (score: number): number =>
  (Number(score) || 0) * (100 / SCORE_SCALE_MAX);

interface PlantOption {
  id: string;
  name: string;
}

interface ZoneOption {
  id: string;
  name: string;
}

interface PerformanceScoreBreakdownChartProps {
  startDate?: string;
  endDate?: string;
  refreshTrigger?: number;
  selectedLocation?: string | null;
  selectedZone?: string | null;
  viewMode?: 'location' | 'zone';
  onZoneChange?: (zone: string | null) => void;
  className?: string;
}

const PerformanceScoreBreakdownChart: React.FC<PerformanceScoreBreakdownChartProps> = ({
  startDate,
  endDate,
  refreshTrigger,
  selectedLocation,
  selectedZone: propSelectedZone,
  viewMode = 'location',
  onZoneChange,
  className,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plantName, setPlantName] = useState<string>('');
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [selectedPlantName, setSelectedPlantName] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(propSelectedZone || null);
  
  // Toggle state: true = Zone Avg, false = Plant Avg
  const [showZoneAvg, setShowZoneAvg] = useState(true);

  // Sync internal selectedZone when prop changes (from parent selection).
  // When selectedLocation is set, skip: the selectedLocation effect will set zone + plant together so we only trigger one API call.
  useEffect(() => {
    if (selectedLocation) return;
    const newZone = propSelectedZone || null;
    if (newZone !== selectedZone) {
      setSelectedZone(newZone);
      setChartData([]);
      setIsLoading(true);
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
      lastFetchedParamsRef.current = '';
    }
  }, [propSelectedZone, selectedZone, selectedLocation]);

  const [zoneOptions, setZoneOptions] = useState<ZoneOption[]>([]);
  const [plantData, setPlantData] = useState<PlantOption[]>([]);
  const [openZone, setOpenZone] = useState(false);
  const [openPlant, setOpenPlant] = useState(false);
  const [selectedDataPoint, setSelectedDataPoint] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<{ [key: string]: boolean }>({});
  const [closeButtonLeft, setCloseButtonLeft] = useState(0);

  // Ref to avoid duplicate API calls
  const lastFetchedParamsRef = useRef<string>('');
  const clearingPlantRef = useRef<boolean>(false);

  // Calculate weighted score helper function
  // const calculateWeightedScore = (score: number, weightage: number) => {
  //   return ((score * weightage) / 100).toFixed(2);
  // };

  useEffect(() => {
    if (!selectedPlantId && !selectedPlantName) {
      setPlantName('');
    }
  }, [selectedPlantId, selectedPlantName]);

  useEffect(() => {
    if (isDialogOpen && selectedDataPoint?.categories) {
      const expanded: { [key: string]: boolean } = {};
      selectedDataPoint.categories.forEach((category: any, index: number) => {
        const categoryKey = `${category.name}-${index}`;
        expanded[categoryKey] = true;
      });
      setExpandedCategories(expanded);
    }
  }, [isDialogOpen, selectedDataPoint]);

  // Reset to default state when refresh is clicked
  const prevRefreshTriggerRef = useRef<number | undefined>(refreshTrigger);
  useEffect(() => {
    if (refreshTrigger === undefined) return;
    if (prevRefreshTriggerRef.current === refreshTrigger) return;
    prevRefreshTriggerRef.current = refreshTrigger;
    localStorage.removeItem('zone');
    localStorage.removeItem('sapId');
    setIsDialogOpen(false);
    setSelectedDataPoint(null);
    setExpandedCategories({});
    setSelectedZone(null);
    setSelectedPlantId(null);
    setSelectedPlantName(null);
    setPlantName('');
    setShowZoneAvg(true); // Reset to Zone Avg
  }, [refreshTrigger]);

  // When Performance Score view is toggled (location ↔️ zone), reset breakdown chart to default
  const prevViewModeRef = useRef(viewMode);
  useEffect(() => {
    if (prevViewModeRef.current === viewMode) return;
    prevViewModeRef.current = viewMode;
    localStorage.removeItem('zone');
    localStorage.removeItem('sapId');
    setIsDialogOpen(false);
    setSelectedDataPoint(null);
    setExpandedCategories({});
    setSelectedZone(null);
    setSelectedPlantId(null);
    setSelectedPlantName(null);
    setPlantName('');
  }, [viewMode]);

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

  // When selectedLocation changes from parent (e.g. user clicked location in Performance Score card)
  useEffect(() => {
    if (!selectedLocation) return;

    // CRITICAL: Force toggle switch to Plant Avg and sync dropdowns from props
    setShowZoneAvg(false);
    const zone = propSelectedZone || null;
    setSelectedZone(zone); // Always sync Zone dropdown so it shows correct zone immediately

    if (plantData.length === 0) {
      setPlantName(selectedLocation);
      setSelectedPlantId(null);
      setSelectedPlantName(null);
      return; // fetchLocationData(zone) will run from selectedZone effect; when plantData loads this effect re-runs
    }

    let matchingPlant = plantData.find(
      (plant) => plant.name.toUpperCase() === selectedLocation.toUpperCase()
    );

    if (!matchingPlant) {
      matchingPlant = plantData.find(
        (plant) =>
          plant.name.toUpperCase().includes(selectedLocation.toUpperCase()) ||
          selectedLocation.toUpperCase().includes(plant.name.toUpperCase())
      );
    }

    if (!matchingPlant) {
      const normalizedLocation = selectedLocation.toUpperCase().trim();
      matchingPlant = plantData.find(
        (plant) => {
          const normalizedPlant = plant.name.toUpperCase().trim();
          const locationWords = normalizedLocation.split(/\s+/).filter((w) => w.length > 2);
          const plantWords = normalizedPlant.split(/\s+/).filter((w) => w.length > 2);
          return (
            locationWords.some((lw) => plantWords.includes(lw)) ||
            plantWords.some((pw) => locationWords.includes(pw))
          );
        }
      );
    }

    if (matchingPlant) {
      setSelectedPlantId(matchingPlant.id);
      setSelectedPlantName(matchingPlant.name);
      setPlantName(matchingPlant.name);

      if (zone) {
        localStorage.setItem('zone', zone);
      }
      localStorage.setItem('sapId', matchingPlant.id);

      setChartData([]);
      setIsLoading(true);
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
    } else {
      setPlantName(selectedLocation);
      setSelectedPlantId(null);
      setSelectedPlantName(null);
    }
  }, [selectedLocation, propSelectedZone, plantData]);

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

  const handleZoneChange = (zoneValue: string) => {
    const zone = zoneValue === '' ? null : zoneValue;
    clearingPlantRef.current = true;
    
    if (onZoneChange) {
      onZoneChange(zone);
    }
    
    setSelectedZone(zone);
    setSelectedPlantId(null);
    setSelectedPlantName(null);
    setPlantName('');
    setChartData([]);
    
    if (zone) {
      localStorage.setItem('zone', zone);
    } else {
      localStorage.removeItem('zone');
    }
    localStorage.removeItem('sapId');
    
    if (rootRef.current) {
      rootRef.current.dispose();
      rootRef.current = null;
    }
    
    lastFetchedParamsRef.current = '';
    
    setTimeout(() => { clearingPlantRef.current = false; }, 100);
  };

  const handlePlantChange = (plantId: string | null, zone: string | null) => {
    if (clearingPlantRef.current) return;
    
    setSelectedPlantId(plantId);
    setSelectedZone(zone);
    setChartData([]);
    
    if (plantId && plantData.length > 0) {
      const selectedPlant = plantData.find(plant => plant.id === plantId);
      const plantNameValue = selectedPlant ? selectedPlant.name : plantId;
      setSelectedPlantName(plantNameValue);
      setPlantName(plantNameValue);
      if (plantId) localStorage.setItem('sapId', plantId);
      
      // When plant is selected, switch to Plant Avg
      setShowZoneAvg(false);
    } else {
      setSelectedPlantName(null);
      setPlantName('');
      localStorage.removeItem('sapId');
      
      // When "All Plants" is selected, switch to Zone Avg
      setShowZoneAvg(true);
    }
    
    if (rootRef.current) {
      rootRef.current.dispose();
      rootRef.current = null;
    }
    
    lastFetchedParamsRef.current = '';
  };

  const fetchPerformanceScoreBreakdown = async () => {
    setIsLoading(true);
    setError(null);
    
    if (rootRef.current) {
      rootRef.current.dispose();
      rootRef.current = null;
    }

    try {
      const locationName = selectedPlantId ? (selectedPlantName || selectedLocation || "") : "";
      const zoneValue = (selectedZone && selectedZone !== "all" && selectedZone !== "") ? selectedZone : "";
      
      const payload = {
        "bu": "TAS",
        "score_type": "TAS",
        "zone": zoneValue,
        "name": locationName,
        "start_date": startDate,
        "end_date": endDate
      };

      const response = await apiClient.post('/api/performancescore/performance_score_breakdown', payload);

      if (response && response.data) {
        let transformedData: any[] = [];

        if (response.data.status === 'success') {
          // Use zone_avg_daywise or plant_avg_daywise based on toggle
          let daywiseData: any[] = [];
          if (showZoneAvg) {
            daywiseData = response.data.zone_avg_daywise || [];
          } else {
            daywiseData = response.data.plant_avg_daywise || [];
          }
          
          const categoriesByDate = new Map<string, any[]>();
          if (Array.isArray(response.data.zones)) {
            response.data.zones.forEach((zone: any) => {
              if (Array.isArray(zone.plants)) {
                zone.plants.forEach((plant: any) => {
                  if (Array.isArray(plant.daywise_scores)) {
                    plant.daywise_scores.forEach((dayScore: any) => {
                      if (dayScore.date && Array.isArray(dayScore.categories) && dayScore.categories.length > 0) {
                        if (!categoriesByDate.has(dayScore.date)) {
                          categoriesByDate.set(dayScore.date, dayScore.categories);
                        }
                      }
                    });
                  }
                });
              }
            });
          }
          
          if (daywiseData.length > 0) {
            transformedData = daywiseData.map((item: any) => {
              const categories = categoriesByDate.get(item.date) || [];
              const rawScore = parseFloat(item.avg_score ?? item.score) || 0;
              return {
                date: item.date || '',
                score: normalizeScore20To100(rawScore),
                plantName: selectedPlantName || selectedLocation || (showZoneAvg ? 'Zone Average' : 'Plant Average'),
                zone: selectedZone || '',
                categories: categories,
                name: 'TAS'
              };
            });
            transformedData.sort((a, b) => {
              const dateA = new Date(a.date).getTime();
              const dateB = new Date(b.date).getTime();
              return dateA - dateB;
            });
          }
        }

        setChartData(transformedData);
        
        if (!selectedPlantId && !selectedPlantName) {
          setPlantName('');
        }
        
        if (transformedData.length === 0) {
          setPlantName('');
        }
      } else {
        setError('No data received from API');
        setChartData([]);
        setPlantName('');
      }
    } catch (err: any) {
      // console.error('Error fetching performance score breakdown:', err);
      setError(err.message || 'Failed to fetch data');
      setChartData([]);
      setPlantName('');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (rootRef.current) {
      rootRef.current.dispose();
      rootRef.current = null;
    }
  }, [selectedPlantName, selectedZone, refreshTrigger, viewMode, showZoneAvg]);

  useEffect(() => {
    const paramsKey = `${startDate}|${endDate}|${refreshTrigger ?? 0}|${selectedPlantName || ''}|${selectedZone || ''}|${viewMode}|${showZoneAvg}`;
    if (paramsKey === lastFetchedParamsRef.current) {
      return;
    }
    // When parent passed a location but we haven't synced plant yet, skip so we only fetch once with the correct location
    if (selectedLocation && selectedPlantName && selectedLocation.toUpperCase().trim() !== selectedPlantName.toUpperCase().trim()) {
      return;
    }
    lastFetchedParamsRef.current = paramsKey;
    fetchPerformanceScoreBreakdown();
  }, [startDate, endDate, refreshTrigger, selectedPlantName, selectedZone, viewMode, showZoneAvg, selectedLocation]);

  // Chart initialization code (keeping original chart code)
  useEffect(() => {
    if (isLoading || !chartRef.current || !chartData || chartData.length === 0) {
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
      return;
    }

    let root: am5.Root;

    if (!rootRef.current) {
      root = am5.Root.new(chartRef.current);
      rootRef.current = root;
      if (root._logo) root._logo.dispose();
      root.setThemes([am5themes_Animated.new(root)]);

      const chart = root.container.children.push(
        am5xy.XYChart.new(root, {
          panX: true,
          panY: true,
          wheelX: 'panX',
          wheelY: 'zoomX',
          paddingLeft: 15,
          paddingRight: 15,
          paddingTop: 15,
          paddingBottom: 8,
        })
      );

      const cursor = chart.set('cursor', am5xy.XYCursor.new(root, { behavior: "none" }));
      cursor.lineY.set('visible', false);
      chart.set("cursor", am5xy.XYCursor.new(root, { behavior: "zoomX" }));

      const xAxis = chart.xAxes.push(
        am5xy.DateAxis.new(root, {
          maxDeviation: 0.2,
          baseInterval: { timeUnit: 'day', count: 1 },
          renderer: am5xy.AxisRendererX.new(root, {
            minGridDistance: 40,
            strokeOpacity: 0.3,
            strokeWidth: 1
          }),
          tooltip: am5.Tooltip.new(root, {}),
        })
      );

      xAxis.get("renderer").labels.template.setAll({
        fontSize: 9,
        fontWeight: "500",
        fill: am5.color("#666666"),
        paddingTop: 8,
        paddingBottom: 8
      });

      xAxis.get("renderer").grid.template.setAll({
        strokeOpacity: 0.15,
        stroke: am5.color("#e5e7eb")
      });

      const maxScore = Math.max(...chartData.map(item => item.score), 100);
      const yAxisMax = Math.min(120, Math.ceil(maxScore * 1.2)); // Normalized to 100 scale; cap axis at 120

      const yAxis = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          renderer: am5xy.AxisRendererY.new(root, {
            strokeOpacity: 0.3,
            strokeWidth: 1,
            inside: false,
            minGridDistance: 30,
          }),
          min: 0,
          max: yAxisMax,
          strictMinMax: true,
        })
      );

      yAxis.get("renderer").labels.template.setAll({
        fontSize: 9,
        fontWeight: "500",
        fill: am5.color("#666666"),
        paddingRight: 8,
        paddingLeft: 4,
        paddingBottom: 4
      });

      yAxis.get("renderer").grid.template.setAll({
        strokeOpacity: 0.15,
        stroke: am5.color("#e5e7eb")
      });

      const series = chart.series.push(
        am5xy.LineSeries.new(root, {
          name: "Performance Score",
          xAxis: xAxis,
          yAxis: yAxis,
          valueYField: "score",
          valueXField: "timestamp",
          stroke: am5.color(CHART_COLOR),
          tooltip: am5.Tooltip.new(root, {
            labelText: "",
            getFillFromSprite: false,
            autoTextColor: false
          }),
          minBulletDistance: 10,
        })
      );

      series.get("tooltip")?.label.adapters.add("text", (text, target) => {
        const dataItem = target.dataItem as am5.DataItem<am5xy.ILineSeriesDataItem>;
        if (dataItem) {
          const valueX = dataItem.get("valueX") as number | undefined;
          const valueY = dataItem.get("valueY") as number | undefined;
          
          let dateStr = "";
          if (valueX) {
            const date = new Date(valueX);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            dateStr = `${day}-${month}-${year}`;
          }
          
          const scoreValue = typeof valueY === 'number' ? valueY.toFixed(2) : '0';
          return `Date: ${dateStr}\nScore: ${scoreValue}`;
        }
        return text;
      });

      series.fills.template.setAll({ fillOpacity: 0, visible: false });
      series.strokes.template.setAll({ strokeWidth: 2, strokeOpacity: 0.8 });

      series.get("tooltip")?.setAll({
        background: am5.RoundedRectangle.new(root, {
          fill: am5.color(CHART_COLOR),
          fillOpacity: 0.9,
          cornerRadiusTL: 4,
          cornerRadiusTR: 4,
          cornerRadiusBL: 4,
          cornerRadiusBR: 4
        }),
        paddingTop: 4,
        paddingBottom: 4,
        paddingLeft: 6,
        paddingRight: 6
      });

      series.get("tooltip")?.label.setAll({
        fill: am5.color("#ffffff"),
        fontWeight: "500",
        fontSize: 10,
        maxWidth: 120
      });

      series.bullets.push((root) => {
        const circle = am5.Circle.new(root, {
          radius: 5,
          fill: am5.color(CHART_COLOR),
          stroke: root.interfaceColors.get("background"),
          strokeWidth: 2,
          cursorOverStyle: "pointer",
          interactive: true,
        });
        
        circle.adapters.add("tooltipText", (text, target) => {
          return "";
        });
        
        const currentChartData = [...chartData];
        
        circle.events.on("click", (ev) => {
          const dataItem = ev.target.dataItem as am5.DataItem<am5xy.ILineSeriesDataItem>;
          if (dataItem) {
            const dataContext = dataItem.dataContext as any;
            if (dataContext) {
              setSelectedDataPoint(dataContext);
              setIsDialogOpen(true);
              setExpandedCategories({});
            } else {
              const valueX = dataItem.get("valueX") as number | undefined;
              const valueY = dataItem.get("valueY") as number | undefined;
              if (valueX && valueY) {
                const matchingPoint = currentChartData.find((item) => {
                  const itemTimestamp = item.timestamp;
                  return Math.abs(itemTimestamp - valueX) < 86400000 &&
                         Math.abs(item.score - valueY) < 0.01;
                });
                if (matchingPoint) {
                  setSelectedDataPoint(matchingPoint);
                  setIsDialogOpen(true);
                  setExpandedCategories({});
                }
              }
            }
          }
        });
        
        return am5.Bullet.new(root, {
          sprite: circle,
        });
      });

      series.bullets.push((root) => {
        const label = am5.Label.new(root, {
          text: "{valueY}",
          fill: am5.color("#333333"),
          centerY: am5.p100,
          centerX: am5.p50,
          populateText: true,
          fontSize: 10,
          fontWeight: "600",
          dy: -8,
        });
        
        label.adapters.add("text", (text, target) => {
          const dataItem = target.dataItem as am5.DataItem<am5xy.ILineSeriesDataItem>;
          if (dataItem) {
            const valueY = dataItem.get("valueY") as number | undefined;
            if (typeof valueY === 'number') {
              return valueY % 1 === 0 ? valueY.toString() : valueY.toFixed(2);
            }
          }
          return text;
        });
        
        const labelBullet = am5.Bullet.new(root, {
          sprite: label,
        });
        return labelBullet;
      });

      const processedData = chartData.map(item => {
        const dateStr = item.date;
        let timestamp;
        if (dateStr && typeof dateStr === 'string' && dateStr.includes('-')) {
          timestamp = new Date(dateStr).getTime();
        } else {
          timestamp = new Date().getTime();
        }
        const rawScore = Number(item.score) || 0;
        const scoreNormalized = rawScore <= 25 ? normalizeScore20To100(rawScore) : rawScore;
        return { ...item, timestamp, score: scoreNormalized };
      });

      xAxis.data.setAll(processedData);
      series.data.setAll(processedData);

      const needScroll = chartData.length > 12;
      if (needScroll) {
        const scrollbarX = am5.Scrollbar.new(root, {
          orientation: "horizontal",
          height: 12
        });
        chart.set("scrollbarX", scrollbarX);
        scrollbarX.get("background").setAll({
          fill: am5.color("#e5e7eb"),
          fillOpacity: 0.8
        });
        scrollbarX.thumb.setAll({
          fill: am5.color("#6b7280"),
          fillOpacity: 0.7
        });
        scrollbarX.startGrip.setAll({ scale: 0.8 });
        scrollbarX.endGrip.setAll({ scale: 0.8 });
        chart.bottomAxesContainer.children.push(scrollbarX);
        setTimeout(() => {
          scrollbarX.set("start", 0);
          scrollbarX.set("end", 12 / chartData.length);
        }, 100);
      }

      /* Legend rendered in React below the plot — keeps it inside the fixed-height card. */
      chart.appear(1000, 100);
    }

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
    };
  }, [chartData, isLoading]);

  // Get display title based on toggle state (use selectedPlantName so long/truncated location names still show in heading)
  const getDisplayTitle = () => {
    if (showZoneAvg) {
      return selectedZone ? ` - Zone: ${selectedZone}` : ' - Zone Average';
    } else {
      const name = plantName || selectedPlantName || (selectedPlantId && plantData.find((p) => p.id === selectedPlantId)?.name);
      return (selectedPlantId && name) ? ` - ${name}` : ' - Plant Average';
    }
  };

  return (
    <Card className={cn("flex h-full min-h-0 w-full flex-col overflow-hidden", className)}>
      <CardHeader className="shrink-0 space-y-0 px-4 pb-2 pt-2 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4 min-w-0">
          <div className="min-w-0 flex flex-col gap-1 lg:min-w-[12rem] lg:flex-1">
            <CardTitle className="text-sm font-semibold text-gray-800 leading-snug break-words">
              TAS Score Trend{getDisplayTitle()}
            </CardTitle>
            {startDate && endDate ? (
              <p className="text-xs text-gray-600 tabular-nums">{`${startDate} to ${endDate}`}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 shrink-0 lg:justify-end">
            <div className="flex items-center gap-3 lg:border-r lg:border-gray-200 lg:pr-3">
              <label className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                <input
                  type="radio"
                  name="avgType"
                  checked={showZoneAvg}
                  onChange={() => setShowZoneAvg(true)}
                  className="w-3.5 h-3.5 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-xs font-medium text-gray-700">Zone</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                <input
                  type="radio"
                  name="avgType"
                  checked={!showZoneAvg}
                  onChange={() => setShowZoneAvg(false)}
                  className="w-3.5 h-3.5 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-xs font-medium text-gray-700">Plant</span>
              </label>
            </div>
            <Popover open={openZone} onOpenChange={setOpenZone}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openZone}
                  className="w-24 min-w-[5.5rem] h-7 text-xs justify-between"
                >
                  {selectedZone
                    ? (zoneOptions.find((z) => z.id === selectedZone)?.name ?? 'Select Zone')
                    : 'All Zones'}
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
                  title={selectedPlantId ? (plantData.find((p) => p.id === selectedPlantId)?.name ?? '') : undefined}
                  className="w-24 min-w-[5.5rem] max-w-[8rem] h-7 text-xs justify-between overflow-hidden"
                >
                  <span className="truncate min-w-0 block text-left">
                    {selectedPlantId
                      ? (plantData.find((p) => p.id === selectedPlantId)?.name ?? 'Select Plant')
                      : 'All Plants'}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50 flex-shrink-0" />
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
                          handlePlantChange(null, selectedZone);
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
                            handlePlantChange(p.id, selectedZone);
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
        </div>
      </CardHeader>
      
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0 px-4 pb-2 pt-0 sm:px-6">
        {error ? (
          <div className="flex min-h-[10rem] flex-1 items-center justify-center text-red-500">
            <div className="text-center">
              <p className="text-sm">Error loading data</p>
              <p className="mt-1 text-xs text-gray-500">{error}</p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: CHART_COLOR }} />
              <p className="text-sm text-gray-600">Loading chart data...</p>
            </div>
          </div>
        ) : chartData.length > 0 ? (
          <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-1">
            <div className="relative min-h-0 w-full min-w-0 flex-1 overflow-hidden">
              <div ref={chartRef} className="h-full w-full min-h-[100px]" />
            </div>
            <div className="flex w-full min-w-0 shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-0.5 border-t border-gray-100 px-0.5 py-1">
              <span className="inline-flex max-w-full items-center gap-1.5 text-[10px] font-semibold leading-tight text-gray-700">
                <span
                  className="h-1.5 w-4 shrink-0 rounded-sm"
                  style={{ backgroundColor: CHART_COLOR }}
                  aria-hidden
                />
                <span className="truncate">Performance Score</span>
              </span>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center text-gray-500">
            <div className="text-center">
              <p className="text-sm">No data available</p>
              <p className="mt-1 text-xs">Check your date range and try again</p>
            </div>
          </div>
        )}
      </CardContent>

      {/* Dialog code remains the same as before */}
      {isDialogOpen && typeof window !== 'undefined' && createPortal(
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
        </button>,
        document.body
      )}
      <Sheet open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <SheetContent
          side="right"
          className="w-[89vw] overflow-hidden flex flex-col h-full [&>button]:hidden !rounded-none"
        >
          <SheetHeader className="flex-shrink-0 flex-row items-center justify-between gap-4 px-6 py-4 border-b border-gray-200 bg-gray-50 space-y-0">
            <SheetTitle className="text-lg font-bold text-gray-900">
              TAS Details for {selectedDataPoint?.plantName || plantName || 'Location'}
            </SheetTitle>
            {selectedDataPoint?.categories && selectedDataPoint.categories.length > 0 && selectedDataPoint.categories.some((c: any) => c.categories && c.categories.length > 0) && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const expanded: { [key: string]: boolean } = {};
                    selectedDataPoint.categories.forEach((category: any, index: number) => {
                      const categoryKey = `${category.name}-${index}`;
                      expanded[categoryKey] = true;
                    });
                    setExpandedCategories(expanded);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-300 rounded hover:bg-blue-50 transition-colors"
                >
                  Expand all
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedCategories({})}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                >
                  Collapse all
                </button>
              </div>
            )}
          </SheetHeader>
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="flex-1 flex flex-col p-6 overflow-hidden min-h-0">
              <div className="border border-gray-300 rounded-lg overflow-hidden flex-1 overflow-y-auto min-h-0">
                <table className="w-full bg-white" style={{ borderCollapse: 'collapse' }}>
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="text-left py-2.5 px-2 text-xs font-semibold text-gray-700 border-b border-gray-300 border-r border-gray-300 w-[35%]">Module</th>
                      <th className="text-left py-2.5 px-2 text-xs font-semibold text-gray-700 border-b border-gray-300 border-r border-gray-300 w-[25%]">Parameter</th>
                      <th className="text-right py-2.5 px-2 text-xs font-semibold text-gray-700 border-b border-gray-300 border-r border-gray-300 w-[13%]">Score</th>
                      <th className="text-right py-2.5 px-2 text-xs font-semibold text-gray-700 border-b border-gray-300 border-r border-gray-300 w-[13%]">Weightage</th>
                      {/* <th className="text-right py-2.5 px-2 text-xs font-semibold text-gray-700 border-b border-gray-300 w-[14%]">Weighted Score</th> */}
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {selectedDataPoint?.categories && selectedDataPoint.categories.length > 0 ? (
                      selectedDataPoint.categories.map((category: any, index: number) => {
                        const categoryKey = `${category.name}-${index}`;
                        const isExpanded = expandedCategories[categoryKey];
                        const hasNested = category.categories && category.categories.length > 0;
                        
                        return (
                          <React.Fragment key={categoryKey}>
                            <tr 
                              className={`border-b border-gray-300 hover:bg-gray-50 transition-colors ${hasNested ? 'cursor-pointer' : ''}`}
                              onClick={() => {
                                if (hasNested) {
                                  setExpandedCategories(prev => ({
                                    ...prev,
                                    [categoryKey]: !prev[categoryKey]
                                  }));
                                }
                              }}
                            >
                              <td className="py-1 px-2 border-r border-gray-300">
                                <div className="flex items-center gap-1">
                                  {hasNested && (
                                    <div className="w-3 h-3 border border-gray-400 rounded flex items-center justify-center flex-shrink-0">
                                      {isExpanded ? (
                                        <Minus className="w-2 h-2 text-gray-600" />
                                      ) : (
                                        <Plus className="w-2 h-2 text-gray-600" />
                                      )}
                                    </div>
                                  )}
                                  <span className="text-xs text-gray-900">{category.name || '-'}</span>
                                </div>
                              </td>
                              <td className="py-1 px-2 border-r border-gray-300"></td>
                              <td className={`py-1 px-2 text-xs text-right border-r border-gray-300 font-semibold ${typeof category.score === 'number' && category.score === 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {typeof category.score === 'number' ? normalizeScore20To100(category.score).toFixed(2) : category.score || '-'}
                              </td>
                              <td className="py-1 px-2 text-xs text-gray-900 text-right border-r border-gray-300">{typeof category.weightage === 'number' ? `${category.weightage}%` : category.weightage || '-'}</td>
                              {/* <td className="py-1 px-2 text-xs text-gray-900 text-right">{typeof category.score === 'number' && typeof category.weightage === 'number' ? calculateWeightedScore(category.score, category.weightage) : '-'}</td> */}
                            </tr>
                            {hasNested && isExpanded && category.categories.map((subCategory: any, subIndex: number) => (
                              <tr key={`sub-${subIndex}`} className="border-b border-gray-300 hover:bg-gray-50/50 transition-colors">
                                <td className="py-1 px-2 border-r border-gray-300"></td>
                                <td className="py-1 px-2 border-r border-gray-300">
                                  <div className="pl-4">
                                    <span className="text-xs text-gray-700">{subCategory.name || '-'}</span>
                                  </div>
                                </td>
                                <td className={`py-1 px-2 text-xs text-right border-r border-gray-300 font-semibold ${typeof subCategory.score === 'number' && subCategory.score === 0 ? 'text-red-600' : 'text-green-600'}`}>
                                  {typeof subCategory.score === 'number' ? normalizeScore20To100(subCategory.score).toFixed(2) : subCategory.score || '-'}
                                </td>
                                <td className="py-1 px-2 text-xs text-gray-900 text-right border-r border-gray-300">{typeof subCategory.weightage === 'number' ? `${subCategory.weightage}%` : subCategory.weightage || '-'}</td>
                                {/* <td className="py-1 px-2 text-xs text-gray-900 text-right">{typeof subCategory.score === 'number' && typeof subCategory.weightage === 'number' ? calculateWeightedScore(subCategory.score, subCategory.weightage) : '-'}</td> */}
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-16 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                              </svg>
                            </div>
                            <div className="text-sm font-medium text-gray-700">No data available</div>
                            <div className="text-xs text-gray-500">No category data found</div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
};

export default PerformanceScoreBreakdownChart;