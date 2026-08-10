import React, { useEffect, useState, useCallback, useRef } from 'react';
import { apiClient } from '@/services/apiClient';
import { Loader2, AlertCircle, Search, XCircle } from 'lucide-react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import * as am5percent from '@amcharts/amcharts5/percent';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { Card, CardHeader, CardTitle, CardContent } from '@/@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/@/components/ui/select';
import { Input } from '@/@/components/ui/input';

interface BayReassignmentProps {
  selectedBu: string;
  selectedZone: string | null;
  selectedPlant: string | null;
  selectedTimeFilter: string | null | { key: string; cond: string; value: string };
  refreshKey: number;
  plantData?: Array<{ id: string; name: string }>;
}

interface BayReassignmentData {
  [key: string]: any;
}

interface TruckReassignment {
  truck_number: string;
  total_reassign_count: number;
  reassigned_bays: string[];
}

const BayReassignment: React.FC<BayReassignmentProps> = ({
  selectedBu,
  selectedZone,
  selectedPlant,
  selectedTimeFilter,
  refreshKey,
  plantData: plantDataProp = [],
}) => {
  const [data, setData] = useState<BayReassignmentData[]>([]);
  const [top10TruckReassignments, setTop10TruckReassignments] = useState<TruckReassignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plantData, setPlantData] = useState<Array<{ id: string; name: string }>>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string>('all');
  const [locationDropdownSearch, setLocationDropdownSearch] = useState('');
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
  const plantDataRef = useRef<Array<{ id: string; name: string }>>([]);
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const zoneChartRef = useRef<HTMLDivElement>(null);
  const zoneChartRootRef = useRef<am5.Root | null>(null);
  const [sliceColors, setSliceColors] = useState<string[]>([]);
  const [selectedTruck, setSelectedTruck] = useState<TruckReassignment | null>(null);
  const [selectedZoneBar, setSelectedZoneBar] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'zone' | 'plant'>('zone');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [detailDialogData, setDetailDialogData] = useState<{
    title: string;
    headers: string[];
    rows: any[];
  } | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  // Convert time filter to date range
  const getDateRange = useCallback(() => {
    const now = new Date();
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (selectedTimeFilter && typeof selectedTimeFilter === 'object' && 'value' in selectedTimeFilter) {
      // Custom date range - value format: "startDate,endDate"
      const dateRangeStr = selectedTimeFilter.value;
      if (dateRangeStr && dateRangeStr.includes(',')) {
        const [startDate, endDate] = dateRangeStr.split(',').map(d => d.trim());
        if (startDate && endDate) {
          return { start_date: startDate, end_date: endDate };
        }
      }
      // Fallback to default if parsing fails
      const s = new Date(now);
      s.setDate(s.getDate() - 15);
      return { start_date: fmt(s), end_date: fmt(now) };
    }

    switch (selectedTimeFilter) {
      case 'TDY':
      case 't':
        return { start_date: fmt(now), end_date: fmt(now) };
      case 'YDY':
      case '1d': {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        return { start_date: fmt(y), end_date: fmt(y) };
      }
      case '1W':
      case '1w': {
        const s = new Date(now);
        s.setDate(s.getDate() - 7);
        return { start_date: fmt(s), end_date: fmt(now) };
      }
      case '15D':
      case '15d': {
        const s = new Date(now);
        s.setDate(s.getDate() - 15);
        return { start_date: fmt(s), end_date: fmt(now) };
      }
      case '1M':
      case '1m': {
        const s = new Date(now);
        s.setDate(s.getDate() - 30);
        return { start_date: fmt(s), end_date: fmt(now) };
      }
      case '3M':
      case '3m': {
        const s = new Date(now);
        s.setDate(s.getDate() - 90);
        return { start_date: fmt(s), end_date: fmt(now) };
      }
      default: {
        const s = new Date(now);
        s.setDate(s.getDate() - 15);
        return { start_date: fmt(s), end_date: fmt(now) };
      }
    }
  }, [selectedTimeFilter]);

  // Use plant data from parent (fetched once at dashboard level)
  useEffect(() => {
    setPlantData(plantDataProp);
    plantDataRef.current = plantDataProp;
  }, [plantDataProp]);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const dateRange = getDateRange();
      
      // Find plant name from plantDataRef
      const selectedPlantObj = plantDataRef.current.find(p => p.id === selectedPlant);
      const plantName = selectedPlantObj ? selectedPlantObj.name : (selectedPlant || "");
      
      const payload = {
        analytical_model: "Hostbay Reassignment Alerts",
        start_date: dateRange.start_date,
        end_date: dateRange.end_date,
        location_name: plantName || "",
        zone: selectedZone || "",
        interlock_name: "",
        alert_status: "",
        alert_severity: [""],
        equipment_type: "",
        equipment_name: "",
        download: "",
        truck_number: ""
      };
      
      console.log('BayReassignment - API Payload:', payload);

      const response = await apiClient.post('/api/tasanalytics/tas_analytics', payload);

      if (response && response.data) {
        // Handle new response structure with data object
        if (response.data.data && typeof response.data.data === 'object') {
          // Extract top_10_truck_reassignments
          if (Array.isArray(response.data.data.top_10_truck_reassignments)) {
            setTop10TruckReassignments(response.data.data.top_10_truck_reassignments);
          } else {
            setTop10TruckReassignments([]);
          }

          // Extract location_based_reassignment for table
          if (Array.isArray(response.data.data.location_based_reassignment)) {
            setData(response.data.data.location_based_reassignment);
          } else {
            setData([]);
          }
        } else {
          // Fallback to old structure
          let dataArray: BayReassignmentData[] = [];
          if (Array.isArray(response.data)) {
            dataArray = response.data;
          } else if (typeof response.data === 'object' && response.data !== null) {
            dataArray = Object.values(response.data);
          }
          setData(dataArray);
          setTop10TruckReassignments([]);
        }
      } else {
        setData([]);
        setTop10TruckReassignments([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch Bay Reassignment data:', err);
      setError(err?.response?.data?.message || err.message || 'Failed to load data');
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedZone, selectedPlant, getDateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  // Filtered locations for the location dropdown (search)
  const filteredLocationOptions = React.useMemo(() => {
    if (!locationDropdownSearch.trim()) return plantData;
    const q = locationDropdownSearch.toLowerCase().trim();
    return plantData.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
    );
  }, [plantData, locationDropdownSearch]);

  // Transform location_based_reassignment data - aggregate by location_name or zone for bar chart
  const transformLocationBarData = useCallback(() => {
    if (!data || data.length === 0) return [];

    const categoryMap = new Map<string, { count: number; zone?: string; location_name?: string }>();
    const categoryVehicleMap = new Map<string, Set<string>>();

    data.forEach((item) => {
      const category = viewMode === 'zone' 
        ? (item.zone || 'Unknown')
        : (item.location_name || 'Unknown');
      const count = item.distinct_fan_count != null ? Number(item.distinct_fan_count) : 1;
      const zone = item.zone || '';
      const locationName = item.location_name || 'Unknown';
      const truckNumber = item.truck_number || '';

      // Aggregate count
      if (categoryMap.has(category)) {
        const existing = categoryMap.get(category)!;
        categoryMap.set(category, {
          count: existing.count + count,
          zone: existing.zone || zone,
          location_name: existing.location_name || locationName,
        });
      } else {
        categoryMap.set(category, { count, zone, location_name: locationName });
      }

      // Track distinct vehicles
      if (truckNumber) {
        if (!categoryVehicleMap.has(category)) {
          categoryVehicleMap.set(category, new Set<string>());
        }
        categoryVehicleMap.get(category)!.add(truckNumber);
      }
    });

    return Array.from(categoryMap.entries())
      .map(([category, { count, zone, location_name }]) => {
        const vehicleCount = categoryVehicleMap.get(category)?.size || 0;
        return {
          location_name: location_name || category,
          count,
          zone: zone || category,
          truck_number: category, // for x-axis categoryField compatibility
          vehicleCount: vehicleCount,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [data, viewMode]);


  // Transform location_based_reassignment data - show each record as a separate bar (truck-level)
  const transformZoneData = useCallback(() => {
    if (!data || data.length === 0) return [];

    return data.map((item) => {
      const truckNumber = item.truck_number || 'Unknown';
      const fanNumber = item.fan_number || '';
      const zone = item.zone || '';
      const count = item.distinct_fan_count || 1;
      
      // Use truck_number as category, but create unique entries for each record
      // Format: truck_number (fan_number) to show both
      const displayLabel = fanNumber ? `${truckNumber} (${fanNumber})` : truckNumber;
      
      return {
        truck_number: displayLabel, // Use display label for y-axis
        original_truck_number: truckNumber, // Keep original truck number
        count,
        fanNumbers: [fanNumber], // Single fan number per record
        zone: zone
      };
    }).sort((a, b) => b.count - a.count);
  }, [data]);


  // Create location-based bar chart
  useEffect(() => {
    const zoneData = transformLocationBarData();

    if (!zoneChartRef.current || zoneData.length === 0) {
      if (zoneChartRootRef.current) {
        zoneChartRootRef.current.dispose();
        zoneChartRootRef.current = null;
      }
      return;
    }

    if (zoneChartRootRef.current) {
      zoneChartRootRef.current.dispose();
    }

    const root = am5.Root.new(zoneChartRef.current);
    zoneChartRootRef.current = root;

    root._logo?.dispose();
    root.setThemes([am5themes_Animated.new(root)]);

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: "panX", // Enable horizontal scroll - scrollbar will handle it when hovered
        wheelY: "none", // Disable vertical scroll on chart
        layout: root.horizontalLayout,
      })
    );

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "truck_number",
        renderer: am5xy.AxisRendererX.new(root, {
          cellStartLocation: 0.2,
          cellEndLocation: 0.6,
          minGridDistance: 30,
        }),
      })
    );

    // Decrease label text size for X axis
    xAxis.get("renderer").labels.template.setAll({
      fontSize: 8,
      fontWeight: "300",
    });

    // Add horizontal scrollbar with adjustable handles - only visible when count > 6
    const scrollbar = chart.set(
      "scrollbarX",
      am5.Scrollbar.new(root, {
        orientation: "horizontal",
        height: 10,
        marginTop: 5,
        marginBottom: 5,
      })
    );
    
    // Show scrollbar only when there are more than 6 categories
    scrollbar.set("visible", zoneData.length > 6);
    
    // Prevent wheel events on chart plot area, but allow on scrollbar
    chart.plotContainer.events.on("wheel", (ev) => {
      // Get the root container DOM element
      const rootDom = root.dom;
      if (!rootDom) return;
      
      const rootRect = rootDom.getBoundingClientRect();
      const mouseY = ev.originalEvent.clientY - rootRect.top;
      const rootHeight = rootRect.height;
      
      // Scrollbar is on the bottom, approximately 20px from the bottom edge
      const scrollbarStartY = rootHeight - 20;
      
      // If mouse is not over scrollbar area (bottom 20px), prevent wheel event
      if (mouseY < scrollbarStartY) {
        ev.originalEvent.preventDefault();
        ev.originalEvent.stopPropagation();
      }
    });

    // Style the horizontal scrollbar background - light blue border
    scrollbar.get("background").setAll({
      fill: am5.color("#ffffff"),
      fillOpacity: 1,
      stroke: am5.color("#2563eb"),
      strokeWidth: 1,
    });

    // Style the horizontal scrollbar thumb - light blue fill
    scrollbar.thumb.setAll({
      fill: am5.color("#DBEAFE"),
      fillOpacity: 1,
      stroke: am5.color("#2563eb"),
      strokeWidth: 0.5,
    });

    // Style and show the start grip (left handle) - white background with blue border
    scrollbar.startGrip.get("background").setAll({
      fill: am5.color("#ffffff"),
      fillOpacity: 1,
      stroke: am5.color("#2563eb"),
      strokeWidth: 1.5,
      width: 8,
      height: 10,
    });

    // Add parallel lines icon to start grip (left handle)
    const startGripIcon = scrollbar.startGrip.get("icon");
    if (startGripIcon) {
      startGripIcon.setAll({
        visible: true,
      });
    }

    // Style and show the end grip (right handle) - white background with blue border
    scrollbar.endGrip.get("background").setAll({
      fill: am5.color("#ffffff"),
      fillOpacity: 1,
      stroke: am5.color("#2563eb"),
      strokeWidth: 1.5,
      width: 8,
      height: 10,
    });

    // Add parallel lines icon to end grip (right handle)
    const endGripIcon = scrollbar.endGrip.get("icon");
    if (endGripIcon) {
      endGripIcon.setAll({
        visible: true,
      });
    }
    
    // Increase 2-finger scroll sensitivity on scrollbar
    // Store current visible indices
    let currentStartIdx = 0;
    let currentEndIdx = Math.min(7, zoneData.length - 1);
    
    const handleScrollbarWheel = (ev: any) => {
      const deltaX = ev.originalEvent.deltaX || ev.originalEvent.deltaY;
      if (deltaX !== 0 && zoneData.length > 0) {
        ev.originalEvent.preventDefault();
        
        // Calculate visible count
        const visibleCount = currentEndIdx - currentStartIdx + 1;
        
        // Increase scroll step significantly - scroll 100% of visible items at a time for much faster scrolling
        const scrollStep = Math.max(1, Math.floor(visibleCount * 1.0));
        
        if (deltaX > 0) {
          // Scroll right
          currentStartIdx = Math.max(0, currentStartIdx + scrollStep);
          currentEndIdx = Math.min(zoneData.length - 1, currentStartIdx + visibleCount - 1);
        } else {
          // Scroll left
          currentEndIdx = Math.min(zoneData.length - 1, currentEndIdx - scrollStep);
          currentStartIdx = Math.max(0, currentEndIdx - visibleCount + 1);
        }
        
        xAxis.zoomToIndexes(currentStartIdx, currentEndIdx);
      }
    };
    
    // Update indices when data is set
    xAxis.events.on("datavalidated", () => {
      // Update scrollbar visibility based on data length
      scrollbar.set("visible", zoneData.length > 6);
      
      // Reset to show last 7 items initially
      if (zoneData.length > 7) {
        currentStartIdx = zoneData.length - 7;
        currentEndIdx = zoneData.length - 1;
      } else {
        currentStartIdx = 0;
        currentEndIdx = zoneData.length - 1;
      }
    });
    
    // Enable enhanced wheel events on scrollbar for increased sensitivity
    scrollbar.get("background").events.on("wheel", handleScrollbarWheel);
    scrollbar.thumb.events.on("wheel", handleScrollbarWheel);
    scrollbar.startGrip.events.on("wheel", handleScrollbarWheel);
    scrollbar.endGrip.events.on("wheel", handleScrollbarWheel);

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {}),
      })
    );

    // Add Y axis title showing "Distinct Count"
    const yAxisTitle = yAxis.children.unshift(
      am5.Label.new(root, {
        rotation: -90,
        text: "Distinct Count",
        y: am5.p50,
        centerX: am5.p50,
      })
    );
    yAxisTitle.setAll({
      fontSize: 10,
      fontWeight: "500",
      fill: am5.color("#374151"),
    });

    // Decrease label text size for Y axis
    yAxis.get("renderer").labels.template.setAll({
      fontSize: 8,
      fontWeight: "300",
    });

    // Create series
    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: "Reassignments",
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "count",
        categoryXField: "truck_number",
        fill: am5.color("#6366F1"), // Indigo-500 - modern dashboard color
      })
    );

    // Apply gradient fill to bars for better visual appeal using adapter
    series.columns.template.adapters.add("fillGradient", () => {
      return am5.LinearGradient.new(root, {
        // rotation: 90,
        stops: [
          { color: am5.color("#3B82F6") }, // Blue-500
          { color: am5.color("#6366F1") }, // Indigo-500
        ],
      });
    });

    // Bars with rounded corners for modern look (width: 0–1 = fraction of category slot)
    series.columns.template.setAll({
      width: am5.percent(60),
      cursorOverStyle: "pointer",
      cornerRadiusTL: 4,
      cornerRadiusTR: 4,
      cornerRadiusBL: 4,
      cornerRadiusBR: 4,
      strokeOpacity: 0,
    });

    // Custom tooltip: location/count/zone/vehicle count
    series.columns.template.adapters.add("tooltipText", (text, target) => {
      const dataContext = target.dataItem?.dataContext as {
        location_name?: string;
        count: number;
        zone?: string;
        vehicleCount?: number;
      };
      if (dataContext) {
        const vehicleCount = dataContext.vehicleCount || 0;
        return `Zone: ${dataContext.zone || '-'}\ncount: ${vehicleCount}`;
      }
      return text;
    });

    // Add click handler to filter table by selected category
    series.columns.template.events.on("click", (ev) => {
      const dataItem = ev.target.dataItem;
      if (dataItem) {
        const dataContext = dataItem.dataContext as {
          truck_number?: string;
          location_name?: string;
          zone?: string;
        };
        const category = dataContext?.truck_number || dataContext?.location_name || dataContext?.zone;
        if (category) {
          setSelectedCategory(category);
        }
      }
    });

    // Add labels on the top of bars using bullets
    series.bullets.push((root, series, dataItem) => {
      const value = dataItem.get("valueY");
      return am5.Bullet.new(root, {
        locationX: 0.5,
        locationY: 1,
        sprite: am5.Label.new(root, {
          text: value ? value.toString() : "",
          fontSize: 10,
          fontWeight: "500",
          fill: am5.color("#374151"),
          centerX: am5.p50,
          centerY: am5.p50,
          paddingTop: 4,
          paddingBottom: 4,
          dy: -20, // Move label 20px away from bar edge
        }),
      });
    });

    // Set initial zoom to show only 4 bars
    series.appear(1000, 100);
    chart.appear(1000, 100);

    // Zoom to show only 7 bars initially (only if more than 6 categories)
    setTimeout(() => {
      if (zoneData.length > 6) {
        if (zoneData.length > 7) {
          xAxis.zoomToIndexes(zoneData.length - 7, zoneData.length - 1);
        }
        scrollbar.set("visible", true);
      } else {
        scrollbar.set("visible", false);
      }
    }, 100);

    // Add data
    xAxis.data.setAll(zoneData);
    series.data.setAll(zoneData);

    // Add cursor
    chart.set("cursor", am5xy.XYCursor.new(root, {}));

    return () => {
      if (zoneChartRootRef.current) {
        zoneChartRootRef.current.dispose();
        zoneChartRootRef.current = null;
      }
    };
  }, [transformLocationBarData, viewMode]);

  // Get column headers from data
  const getColumnHeaders = () => {
    if (!data || data.length === 0) return [];
    return Object.keys(data[0]);
  };

  // Format header name (convert snake_case to Title Case)
  const formatHeaderName = (key: string): string => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Format cell value
  const formatCellValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const isTruckList = (value: any, key?: string): value is Record<string, any>[] => {
    if (!Array.isArray(value)) return false;
    if (key && key.toLowerCase().includes('truck')) return true;
    return value.some(
      (item) =>
        item &&
        typeof item === 'object' &&
        ('truck_number' in item || 'truck' in item || 'assigned_bay' in item || 'reassigned_bay' in item)
    );
  };

  const handleTruckCountClick = (rowIndex: number, key: string) => {
    const row = filteredData[rowIndex];
    const value = row?.[key];
    if (!isTruckList(value, key)) return;

    const headers = Array.from(
      new Set(
        (value as any[]).reduce<string[]>((keys, obj) => {
          if (obj && typeof obj === 'object') {
            Object.keys(obj).forEach((k) => {
              if (!keys.includes(k)) keys.push(k);
            });
          }
          return keys;
        }, [])
      )
    );

    setDetailDialogData({
      title: `${formatHeaderName(key)} (${value.length} truck${value.length === 1 ? '' : 's'})`,
      headers,
      rows: value,
    });
    setIsDetailDialogOpen(true);
  };

  // Filter and sort data - show top 10 by Reassign Count
  const filterData = (data: BayReassignmentData[]) => {
    let filtered = data;

    // Apply zone filter if a zone bar is selected
    if (selectedZoneBar) {
      filtered = filtered.filter(item => {
        const zoneValue = item.zone || '';
        return String(zoneValue).toUpperCase() === selectedZoneBar.toUpperCase();
      });
    }

    // Apply location filter if a specific location is selected (dropdown)
    if (selectedLocationFilter !== 'all') {
      filtered = filtered.filter(item => {
        const locationValue = item.location_name || item.location || item.name || '';
        return String(locationValue).toLowerCase() === selectedLocationFilter.toLowerCase();
      });
    }

    // Apply search filter if search term exists
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item => {
        return Object.values(item).some(value => {
          const stringValue = formatCellValue(value).toLowerCase();
          return stringValue.includes(searchLower);
        });
      });
    }

    // Find the column that contains reassign count
    const reassignCountKeys = ['reassign_count', 'total_reassign_count', 'reassigncount', 'count'];
    let countKey: string | null = null;
    
    if (filtered.length > 0) {
      const keys = Object.keys(filtered[0]);
      countKey = keys.find(key => 
        reassignCountKeys.some(reassignKey => 
          key.toLowerCase().includes(reassignKey.toLowerCase())
        )
      ) || null;
    }

    // Sort by reassign count (descending) and take top 10
    if (countKey) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = Number(a[countKey!]) || 0;
        const bValue = Number(b[countKey!]) || 0;
        return bValue - aValue;
      }).slice(0, 10);
    }
    return filtered;
  };

  const filteredData = filterData(data);
  const columnHeaders = getColumnHeaders();

  const selectedPlantName = selectedPlant
    ? (plantData.find((p) => p.id === selectedPlant)?.name || selectedPlant)
    : null;


  return (
    <div className="min-h-screen bg-gray-50 p-1">
      <div className="max-w-[1920px] mx-auto space-y-1">
        {/* Bar Chart for Zone-based Reassignments */}
        <Card className="bg-white rounded-lg shadow-sm border space-y-0">
          <CardHeader className="border-b p-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Reassignment Analytics
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">View:</span>
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => {
                      setViewMode('zone');
                      setSelectedCategory(null);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      viewMode === 'zone'
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Zone
                  </button>
                  <button
                    onClick={() => {
                      setViewMode('plant');
                      setSelectedCategory(null);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      viewMode === 'plant'
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Plant
                  </button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            {isLoading ? (
              <div className="flex items-center justify-center" style={{ height: '256px' }}>
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#1e88e5' }} />
                  <span className="text-gray-500 font-medium">Loading chart data...</span>
                </div>
              </div>
            ) : transformLocationBarData().length > 0 ? (
              <div className="flex flex-col gap-3">
                {/* Filter indicator above chart */}
                {selectedCategory && (
                  <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    <div className="text-xs text-gray-700">
                      Filtered by {viewMode}: <span className="font-medium text-blue-600">{selectedCategory}</span>
                    </div>
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
                      title="Clear filter"
                    >
                      Clear Filter
                    </button>
                  </div>
                )}
                <div className="flex gap-6 h-64 items-stretch justify-start min-h-0">
                  {/* Bar Chart */}
                  <div className="w-1/2 min-w-0 h-full flex flex-col flex-shrink-0">
                    {!isLoading && transformLocationBarData().length > 0 && (
                      <div className="text-[10px] text-gray-500 px-1 pb-1 shrink-0">
                        Click on bar to filter by {viewMode === 'zone' ? 'zone' : 'plant'}
                      </div>
                    )}
                    <div className="flex-1 min-h-0 flex items-center justify-center">
                      <div ref={zoneChartRef} className="w-full h-full min-h-[250px]"></div>
                    </div>
                  </div>
                  {/* Table */}
                  <div className="w-1/2 min-w-0 h-full flex flex-col overflow-hidden">
                    <div className="border overflow-hidden bg-white rounded-lg" style={{ borderColor: '#1e88e5' }}>
                      <div className="px-3 py-2 text-xs font-semibold text-white shrink-0" style={{ background: '#1e88e5' }}>
                        Truck & Fan Details
                      </div>
                      <div className="overflow-y-auto flex-1 max-h-[240px]">
                        <table className="w-full text-xs border-collapse">
                          <thead className="sticky top-0 bg-gray-100">
                            <tr>
                              <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b">Truck Number</th>
                              <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b">Fan Number</th>
                              <th className="px-2 py-1.5 text-right font-semibold text-gray-700 border-b">Distinct Count</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data
                              .filter((row) => {
                                if (!selectedCategory) return true;
                                if (viewMode === 'zone') {
                                  return String(row.zone || '').toLowerCase() === selectedCategory.toLowerCase();
                                } else {
                                  return String(row.location_name || '').toLowerCase() === selectedCategory.toLowerCase();
                                }
                              })
                              .map((row, idx) => (
                                <tr key={idx} className="border-b border-gray-100 hover:bg-blue-50/50">
                                  <td className="px-2 py-1.5 text-gray-800">{formatCellValue(row.truck_number)}</td>
                                  <td className="px-2 py-1.5 text-gray-800">{formatCellValue(row.fan_number)}</td>
                                  <td className="px-2 py-1.5 text-right text-gray-800">{formatCellValue(row.distinct_fan_count)}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center" style={{ height: '256px' }}>
                <p className="text-gray-500 font-medium">No chart data available</p>
              </div>
            )}
          </CardContent>
        </Card>

      {/* Error State */}
      {error && !isLoading && (
        <div className="text-center py-8">
          <p className="text-red-600 text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Bay Reassignment Data Table */}
      {!error && (
        <Card className="bg-white rounded-lg shadow-sm border space-y-0">
        
          <CardHeader className="border-b p-2">
  <div className="flex items-center justify-between gap-4">
    {/* Title */}
    <CardTitle className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
      Bay Reassignment Data
    </CardTitle>

    {/* Location Filter (moved to end/right) */}
    <div className="flex items-center gap-2 mr-4">

      <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
        Location:
      </span>
      <div className="relative w-64">
        <Select
          value={selectedLocationFilter}
          onValueChange={setSelectedLocationFilter}
          open={locationDropdownOpen}
          onOpenChange={(open) => {
            setLocationDropdownOpen(open);
            if (!open) setLocationDropdownSearch('');
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All Locations" />
          </SelectTrigger>
          <SelectContent>
            <div
              className="flex items-center border-b px-2 pb-2 mb-1 sticky top-0 bg-popover"
              onClick={(e) => e.stopPropagation()}
            >
              <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                placeholder="Search locations..."
                value={locationDropdownSearch}
                onChange={(e) => setLocationDropdownSearch(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                className="border-0 h-8 p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
              />
            </div>
            <SelectItem value="all">All Locations</SelectItem>
            {filteredLocationOptions.map((plant) => (
              <SelectItem key={plant.id} value={plant.name}>
                {plant.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedLocationFilter !== 'all' && (
          <button
            type="button"
            onClick={() => setSelectedLocationFilter('all')}
            className="absolute right-8 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
            title="Clear location filter"
          >
            <XCircle className="h-4 w-4 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>
    </div>
  </div>
</CardHeader>

          <CardContent className="p-1">
            <div className="mb-4">
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search table records..."
                  disabled={isLoading}
                  className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm bg-white disabled:bg-gray-100 disabled:cursor-not-allowed shadow-sm"
                />
                {searchTerm && !isLoading && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center hover:bg-gray-100 rounded-r-lg transition-colors"
                  >
                    <XCircle className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
            </div>
            <div className="border overflow-hidden bg-white" style={{ borderColor: '#1e88e5' }}>
          <div className="overflow-x-auto overflow-y-auto max-h-[500px] relative">
            <table className="w-max min-w-full divide-y relative" style={{ '--divider-color': '#1e88e5' } as React.CSSProperties}>
              <thead className="sticky top-0 z-10" style={{ background: '#1e88e5' }}>
                <tr>
                  {columnHeaders.map((header) => (
                    <th
                      key={header}
                      className="px-6 py-3 text-left text-sm font-bold text-white uppercase tracking-wider whitespace-nowrap"
                    >
                      {formatHeaderName(header)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white" style={{ '--divider-color': '#1e88e540' } as React.CSSProperties}>
                {isLoading ? (
                  <tr>
                    <td colSpan={columnHeaders.length} className="px-4 py-8 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#1e88e5' }} />
                        <span className="text-gray-500 font-medium">Loading Bay Reassignment data...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredData.length > 0 ? (
                  filteredData.map((item, index) => (
                    <tr
                      key={index}
                      className="transition-colors hover:[background-color:#1e88e510]"
                      style={{ borderBottom: '1px solid #1e88e540' }}
                    >
                      {columnHeaders.map((header) => {
                        const value = item[header];
                        if (isTruckList(value, header)) {
                          const countLabel = `${value.length} truck${value.length === 1 ? '' : 's'}`;
                          return (
                            <td key={header} className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                              <button
                                onClick={() => handleTruckCountClick(index, header)}
                                className="hover:underline font-medium cursor-pointer hover:[color:#1976d2]"
                                style={{ color: '#1e88e5' }}
                              >
                                {countLabel}
                              </button>
                            </td>
                          );
                        }
                        return (
                          <td key={header} className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                            {formatCellValue(value)}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={columnHeaders.length} className="px-4 py-6 text-center">
                      <p className="text-gray-600 font-medium">
                        {data.length > 0 ? 'No data found matching your search' : 'No data available'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Truck Details Dialog */}
      <Dialog
        open={isDetailDialogOpen}
        onOpenChange={(open) => {
          setIsDetailDialogOpen(open);
          if (!open) setDetailDialogData(null);
        }}
      >
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader className="pb-3">
            <DialogTitle className="text-lg font-bold text-gray-900">
              {detailDialogData?.title || 'Truck Details'}
            </DialogTitle>
          </DialogHeader>
          {detailDialogData ? (
            <div className="border overflow-hidden shadow-sm bg-white rounded-lg" style={{ borderColor: '#1e88e5' }}>
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      {detailDialogData.headers.map((detailKey) => (
                        <th
                          key={detailKey}
                          className="px-6 py-3 text-left text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-300 whitespace-nowrap"
                        >
                          {formatHeaderName(detailKey)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {detailDialogData.rows.map((truck: any, idx: number) => (
                      <tr key={idx} className="border-b border-gray-200">
                        {detailDialogData.headers.map((detailKey) => (
                          <td key={detailKey} className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">
                            {formatCellValue(truck?.[detailKey])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600">No truck details available.</p>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
};

export default BayReassignment;



// import React, { useEffect, useState, useCallback, useRef } from 'react';
// import { apiClient } from '@/services/apiClient';
// import { Loader2, AlertCircle, Search, XCircle } from 'lucide-react';
// import * as am5 from '@amcharts/amcharts5';
// import * as am5xy from '@amcharts/amcharts5/xy';
// import * as am5percent from '@amcharts/amcharts5/percent';
// import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
// import { Card, CardHeader, CardTitle, CardContent } from '@/@/components/ui/card';
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/@/components/ui/dialog';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/@/components/ui/select';

// interface BayReassignmentProps {
//   selectedBu: string;
//   selectedZone: string | null;
//   selectedPlant: string | null;
//   selectedTimeFilter: string | null | { key: string; cond: string; value: string };
//   refreshKey: number;
// }

// interface BayReassignmentData {
//   [key: string]: any;
// }

// interface TruckReassignment {
//   truck_number: string;
//   total_reassign_count: number;
//   reassigned_bays: string[];
// }

// const BayReassignment: React.FC<BayReassignmentProps> = ({
//   selectedBu,
//   selectedZone,
//   selectedPlant,
//   selectedTimeFilter,
//   refreshKey,
// }) => {
//   const [data, setData] = useState<BayReassignmentData[]>([]);
//   const [top10TruckReassignments, setTop10TruckReassignments] = useState<TruckReassignment[]>([]);
//   const [isLoading, setIsLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [plantData, setPlantData] = useState<Array<{ id: string; name: string }>>([]);
//   const [searchTerm, setSearchTerm] = useState('');
//   const [selectedLocationFilter, setSelectedLocationFilter] = useState<string>('all');
//   const plantDataRef = useRef<Array<{ id: string; name: string }>>([]);
//   const chartRef = useRef<HTMLDivElement>(null);
//   const rootRef = useRef<am5.Root | null>(null);
//   const zoneChartRef = useRef<HTMLDivElement>(null);
//   const zoneChartRootRef = useRef<am5.Root | null>(null);
//   const pieChartRef = useRef<HTMLDivElement>(null);
//   const pieChartRootRef = useRef<am5.Root | null>(null);
//   const [sliceColors, setSliceColors] = useState<string[]>([]);
//   const [selectedTruck, setSelectedTruck] = useState<TruckReassignment | null>(null);
//   const [selectedZoneBar, setSelectedZoneBar] = useState<string | null>(null);
//   const [selectedLocationBar, setSelectedLocationBar] = useState<string | null>(null);
//   const [pieChartDrillState, setPieChartDrillState] = useState<"zone" | "plant">("zone");
//   const [detailDialogData, setDetailDialogData] = useState<{
//     title: string;
//     headers: string[];
//     rows: any[];
//   } | null>(null);
//   const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

//   // Convert time filter to date range
//   const getDateRange = useCallback(() => {
//     const now = new Date();
//     const fmt = (d: Date) =>
//       `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

//     if (selectedTimeFilter && typeof selectedTimeFilter === 'object' && 'value' in selectedTimeFilter) {
//       // Custom date range - value format: "startDate,endDate"
//       const dateRangeStr = selectedTimeFilter.value;
//       if (dateRangeStr && dateRangeStr.includes(',')) {
//         const [startDate, endDate] = dateRangeStr.split(',').map(d => d.trim());
//         if (startDate && endDate) {
//           return { start_date: startDate, end_date: endDate };
//         }
//       }
//       // Fallback to default if parsing fails
//       const s = new Date(now);
//       s.setDate(s.getDate() - 15);
//       return { start_date: fmt(s), end_date: fmt(now) };
//     }

//     switch (selectedTimeFilter) {
//       case 'TDY':
//       case 't':
//         return { start_date: fmt(now), end_date: fmt(now) };
//       case 'YDY':
//       case '1d': {
//         const y = new Date(now);
//         y.setDate(y.getDate() - 1);
//         return { start_date: fmt(y), end_date: fmt(y) };
//       }
//       case '1W':
//       case '1w': {
//         const s = new Date(now);
//         s.setDate(s.getDate() - 7);
//         return { start_date: fmt(s), end_date: fmt(now) };
//       }
//       case '15D':
//       case '15d': {
//         const s = new Date(now);
//         s.setDate(s.getDate() - 15);
//         return { start_date: fmt(s), end_date: fmt(now) };
//       }
//       case '1M':
//       case '1m': {
//         const s = new Date(now);
//         s.setDate(s.getDate() - 30);
//         return { start_date: fmt(s), end_date: fmt(now) };
//       }
//       case '3M':
//       case '3m': {
//         const s = new Date(now);
//         s.setDate(s.getDate() - 90);
//         return { start_date: fmt(s), end_date: fmt(now) };
//       }
//       default: {
//         const s = new Date(now);
//         s.setDate(s.getDate() - 15);
//         return { start_date: fmt(s), end_date: fmt(now) };
//       }
//     }
//   }, [selectedTimeFilter]);

//   useEffect(() => {
//     const fetchPlantData = async () => {
//       try {
//         const zoneFilter = selectedZone ? [selectedZone] : [];
//         const payload = {
//           bu: selectedBu === 'SOD' ? 'TAS' : selectedBu,
//           zone: zoneFilter,
//           plant: []
//         };
//         const response = await apiClient.post('/api/indentdryout/get_distinct_location_details', payload);
//         if (response?.data?.status === true && response.data.data?.plant) {
//           const plants = response.data.data.plant.map((p: any) => ({
//             id: String(p.id || p.sap_id || ''),
//             name: p.name || p.location_name || ''
//           })).filter((p: any) => p.id && p.name);
//           setPlantData(plants);
//           plantDataRef.current = plants;
//         }
//       } catch (error) {
//         console.error("Error fetching plant data:", error);
//       }
//     };
//     fetchPlantData();
//   }, [selectedBu, selectedZone]);

//   const fetchData = useCallback(async () => {
//     try {
//       setIsLoading(true);
//       setError(null);

//       const dateRange = getDateRange();
      
//       // Find plant name from plantDataRef
//       const selectedPlantObj = plantDataRef.current.find(p => p.id === selectedPlant);
//       const plantName = selectedPlantObj ? selectedPlantObj.name : (selectedPlant || "");
      
//       const payload = {
//         analytical_model: "Hostbay Reassignment Alerts",
//         start_date: dateRange.start_date,
//         end_date: dateRange.end_date,
//         location_name: plantName || "",
//         zone: selectedZone || "",
//         interlock_name: "",
//         alert_status: "",
//         alert_severity: [""],
//         equipment_type: "",
//         equipment_name: "",
//         download: "",
//         truck_number: ""
//       };
      
//       console.log('BayReassignment - API Payload:', payload);

//       const response = await apiClient.post('/api/tasanalytics/tas_analytics', payload);

//       if (response && response.data) {
//         // Handle new response structure with data object
//         if (response.data.data && typeof response.data.data === 'object') {
//           // Extract top_10_truck_reassignments
//           if (Array.isArray(response.data.data.top_10_truck_reassignments)) {
//             setTop10TruckReassignments(response.data.data.top_10_truck_reassignments);
//           } else {
//             setTop10TruckReassignments([]);
//           }

//           // Extract location_based_reassignment for table
//           if (Array.isArray(response.data.data.location_based_reassignment)) {
//             setData(response.data.data.location_based_reassignment);
//           } else {
//             setData([]);
//           }
//         } else {
//           // Fallback to old structure
//           let dataArray: BayReassignmentData[] = [];
//           if (Array.isArray(response.data)) {
//             dataArray = response.data;
//           } else if (typeof response.data === 'object' && response.data !== null) {
//             dataArray = Object.values(response.data);
//           }
//           setData(dataArray);
//           setTop10TruckReassignments([]);
//         }
//       } else {
//         setData([]);
//         setTop10TruckReassignments([]);
//       }
//     } catch (err: any) {
//       console.error('Failed to fetch Bay Reassignment data:', err);
//       setError(err?.response?.data?.message || err.message || 'Failed to load data');
//       setData([]);
//     } finally {
//       setIsLoading(false);
//     }
//   }, [selectedZone, selectedPlant, getDateRange]);

//   useEffect(() => {
//     fetchData();
//   }, [fetchData, refreshKey]);

//   // Transform location_based_reassignment data - aggregate by location_name for bar chart
//   const transformLocationBarData = useCallback(() => {
//     if (!data || data.length === 0) return [];

//     const locationMap = new Map<string, { count: number; zone: string }>();

//     data.forEach((item) => {
//       const locationName = item.location_name || 'Unknown';
//       const zone = item.zone || '';
//       const count = item.distinct_fan_count != null ? Number(item.distinct_fan_count) : 1;

//       if (locationMap.has(locationName)) {
//         const existing = locationMap.get(locationName)!;
//         locationMap.set(locationName, {
//           count: existing.count + count,
//           zone: existing.zone || zone,
//         });
//       } else {
//         locationMap.set(locationName, { count, zone });
//       }
//     });

//     return Array.from(locationMap.entries())
//       .map(([location_name, { count, zone }]) => ({
//         location_name,
//         count,
//         zone,
//         truck_number: location_name, // for y-axis categoryField compatibility
//       }))
//       .sort((a, b) => b.count - a.count);
//   }, [data]);

//   // Transform location_based_reassignment data - show each record as a separate bar (truck-level)
//   const transformZoneData = useCallback(() => {
//     if (!data || data.length === 0) return [];

//     return data.map((item) => {
//       const truckNumber = item.truck_number || 'Unknown';
//       const fanNumber = item.fan_number || '';
//       const zone = item.zone || '';
//       const count = item.distinct_fan_count || 1;
      
//       // Use truck_number as category, but create unique entries for each record
//       // Format: truck_number (fan_number) to show both
//       const displayLabel = fanNumber ? `${truckNumber} (${fanNumber})` : truckNumber;
      
//       return {
//         truck_number: displayLabel, // Use display label for y-axis
//         original_truck_number: truckNumber, // Keep original truck number
//         count,
//         fanNumbers: [fanNumber], // Single fan number per record
//         zone: zone
//       };
//     }).sort((a, b) => b.count - a.count);
//   }, [data]);

//   // Transform data by zone or location_name for pie chart
//   const transformZoneDataForPie = useCallback(() => {
//     if (!data || data.length === 0) return [];

//     const categoryMap = new Map<string, number>();

//     data.forEach((item) => {
//       const category = pieChartDrillState === "zone" 
//         ? (item.zone || 'Unknown')
//         : (item.location_name || 'Unknown');
//       const count = item.distinct_fan_count || 1;
      
//       if (categoryMap.has(category)) {
//         categoryMap.set(category, categoryMap.get(category)! + count);
//       } else {
//         categoryMap.set(category, count);
//       }
//     });

//     return Array.from(categoryMap.entries())
//       .map(([category, count]) => ({ 
//         category, 
//         value: count
//       }))
//       .sort((a, b) => b.value - a.value);
//   }, [data, pieChartDrillState]);

//   // Create location-based bar chart
//   useEffect(() => {
//     const zoneData = transformLocationBarData();
    
//     if (!zoneChartRef.current || zoneData.length === 0) {
//       if (zoneChartRootRef.current) {
//         zoneChartRootRef.current.dispose();
//         zoneChartRootRef.current = null;
//       }
//       return;
//     }

//     if (zoneChartRootRef.current) {
//       zoneChartRootRef.current.dispose();
//     }

//     const root = am5.Root.new(zoneChartRef.current);
//     zoneChartRootRef.current = root;

//     root._logo?.dispose();
//     root.setThemes([am5themes_Animated.new(root)]);

//     const chart = root.container.children.push(
//       am5xy.XYChart.new(root, {
//         panX: true,
//         panY: true,
//         wheelX: "none", // Disable horizontal scroll on chart
//         wheelY: "panY", // Enable vertical scroll - scrollbar will handle it when hovered
//         layout: root.verticalLayout,
//       })
//     );

//     const yAxis = chart.yAxes.push(
//       am5xy.CategoryAxis.new(root, {
//         categoryField: "truck_number",
//         renderer: am5xy.AxisRendererY.new(root, {
//           cellStartLocation: 0.2,
//           cellEndLocation: 0.6,
//           minGridDistance: 30,
//         }),
//       })
//     );

//     // Decrease label text size for Y axis
//     yAxis.get("renderer").labels.template.setAll({
//       fontSize: 8,
//       fontWeight: "300",
//     });

//     // Add vertical scrollbar with adjustable handles (like VTSInsightDash)
//     const scrollbar = chart.set(
//       "scrollbarY",
//       am5.Scrollbar.new(root, {
//         orientation: "vertical",
//         width: 10,
//         marginLeft: 5,
//         marginRight: 5,
//       })
//     );
    
//     // Prevent wheel events on chart plot area, but allow on scrollbar
//     chart.plotContainer.events.on("wheel", (ev) => {
//       // Get the root container DOM element
//       const rootDom = root.dom;
//       if (!rootDom) return;
      
//       const rootRect = rootDom.getBoundingClientRect();
//       const mouseX = ev.originalEvent.clientX - rootRect.left;
//       const rootWidth = rootRect.width;
      
//       // Scrollbar is on the right side, approximately 20px from the right edge
//       const scrollbarStartX = rootWidth - 20;
      
//       // If mouse is not over scrollbar area (right 20px), prevent wheel event
//       if (mouseX < scrollbarStartX) {
//         ev.originalEvent.preventDefault();
//         ev.originalEvent.stopPropagation();
//       }
//     });

//     // Style the vertical scrollbar background - light blue border
//     scrollbar.get("background").setAll({
//       fill: am5.color("#ffffff"),
//       fillOpacity: 1,
//       stroke: am5.color("#2563eb"),
//       strokeWidth: 1,
//     });

//     // Style the vertical scrollbar thumb - light blue fill
//     scrollbar.thumb.setAll({
//       fill: am5.color("#DBEAFE"),
//       fillOpacity: 1,
//       stroke: am5.color("#2563eb"),
//       strokeWidth: 0.5,
//     });

//     // Style and show the start grip (top handle) - white background with blue border
//     scrollbar.startGrip.get("background").setAll({
//       fill: am5.color("#ffffff"),
//       fillOpacity: 1,
//       stroke: am5.color("#2563eb"),
//       strokeWidth: 1.5,
//       width: 10,
//       height: 8,
//     });

//     // Add parallel lines icon to start grip (top handle)
//     const startGripIcon = scrollbar.startGrip.get("icon");
//     if (startGripIcon) {
//       startGripIcon.setAll({
//         visible: true,
//       });
//     }

//     // Style and show the end grip (bottom handle) - white background with blue border
//     scrollbar.endGrip.get("background").setAll({
//       fill: am5.color("#ffffff"),
//       fillOpacity: 1,
//       stroke: am5.color("#2563eb"),
//       strokeWidth: 1.5,
//       width: 10,
//       height: 8,
//     });

//     // Add parallel lines icon to end grip (bottom handle)
//     const endGripIcon = scrollbar.endGrip.get("icon");
//     if (endGripIcon) {
//       endGripIcon.setAll({
//         visible: true,
//       });
//     }
    
//     // Increase 2-finger scroll sensitivity on scrollbar
//     // Store current visible indices
//     let currentStartIdx = 0;
//     let currentEndIdx = Math.min(7, zoneData.length - 1);
    
//     const handleScrollbarWheel = (ev: any) => {
//       const deltaY = ev.originalEvent.deltaY;
//       if (deltaY !== 0 && zoneData.length > 0) {
//         ev.originalEvent.preventDefault();
        
//         // Calculate visible count
//         const visibleCount = currentEndIdx - currentStartIdx + 1;
        
//         // Increase scroll step significantly - scroll 100% of visible items at a time for much faster scrolling
//         const scrollStep = Math.max(1, Math.floor(visibleCount * 1.0));
        
//         if (deltaY > 0) {
//           // Scroll down
//           currentStartIdx = Math.max(0, currentStartIdx + scrollStep);
//           currentEndIdx = Math.min(zoneData.length - 1, currentStartIdx + visibleCount - 1);
//         } else {
//           // Scroll up
//           currentEndIdx = Math.min(zoneData.length - 1, currentEndIdx - scrollStep);
//           currentStartIdx = Math.max(0, currentEndIdx - visibleCount + 1);
//         }
        
//         yAxis.zoomToIndexes(currentStartIdx, currentEndIdx);
//       }
//     };
    
//     // Update indices when data is set
//     yAxis.events.on("datavalidated", () => {
//       // Reset to show last 7 items initially
//       if (zoneData.length > 7) {
//         currentStartIdx = zoneData.length - 7;
//         currentEndIdx = zoneData.length - 1;
//       } else {
//         currentStartIdx = 0;
//         currentEndIdx = zoneData.length - 1;
//       }
//     });
    
//     // Enable enhanced wheel events on scrollbar for increased sensitivity
//     scrollbar.get("background").events.on("wheel", handleScrollbarWheel);
//     scrollbar.thumb.events.on("wheel", handleScrollbarWheel);
//     scrollbar.startGrip.events.on("wheel", handleScrollbarWheel);
//     scrollbar.endGrip.events.on("wheel", handleScrollbarWheel);

//     const xAxis = chart.xAxes.push(
//       am5xy.ValueAxis.new(root, {
//         renderer: am5xy.AxisRendererX.new(root, {}),
//       })
//     );

//     // Decrease label text size for X axis
//     xAxis.get("renderer").labels.template.setAll({
//       fontSize: 8,
//       fontWeight: "300",
//     });

//     // Create series
//     const series = chart.series.push(
//       am5xy.ColumnSeries.new(root, {
//         name: "Reassignments",
//         xAxis: xAxis,
//         yAxis: yAxis,
//         valueXField: "count",
//         categoryYField: "truck_number",
//         fill: am5.color("#2563eb"),
//       })
//     );

//     // Add rounded corners to bars
//     series.columns.template.setAll({
//       cursorOverStyle: "pointer",
//       cornerRadiusTR: 6,
//       cornerRadiusBR: 6,
//       strokeOpacity: 0,
//     });

//     // Custom tooltip adapter to show location and count
//     series.columns.template.adapters.add("tooltipText", (text, target) => {
//       const dataContext = target.dataItem?.dataContext as { location_name: string; count: number; zone: string };
//       if (dataContext) {
//         return `${dataContext.location_name || ''}\nCount: ${dataContext.count}\nZone: ${dataContext.zone || '-'}`;
//       }
//       return text;
//     });

//     // Add labels on the right side of bars using bullets
//     series.bullets.push((root, series, dataItem) => {
//       const value = dataItem.get("valueX");
//       return am5.Bullet.new(root, {
//         locationX: 1,
//         locationY: 0.5,
//         sprite: am5.Label.new(root, {
//           text: value ? value.toString() : "",
//           fontSize: 10,
//           fontWeight: "500",
//           fill: am5.color("#374151"),
//           centerX: am5.p50,
//           centerY: am5.p50,
//           paddingLeft: 8, // Add padding inside label
//           paddingRight: 8,
//           dx: 20, // Move label 20px away from bar edge
//         }),
//       });
//     });

//     series.columns.template.events.on("click", (ev) => {
//       const dataItem = ev.target.dataItem;
//       if (dataItem) {
//         const dataContext = dataItem.dataContext as { location_name: string; count: number; zone: string };
//         const locationName = dataContext?.location_name;
//         if (locationName) {
//           setSelectedLocationBar(locationName);
//           setSelectedZoneBar(null);
//         }
//       }
//     });

//     // Set initial zoom to show only 4 bars
//     series.appear(1000, 100);
//     chart.appear(1000, 100);

//     // Zoom to show only 7 bars initially
//     setTimeout(() => {
//       if (zoneData.length > 7) {
//         yAxis.zoomToIndexes(zoneData.length - 7, zoneData.length - 1);
//       }
//     }, 100);

//     // Add data
//     yAxis.data.setAll(zoneData);
//     series.data.setAll(zoneData);

//     // Add cursor
//     chart.set("cursor", am5xy.XYCursor.new(root, {}));

//     // Add small legend
//     const legend = chart.children.push(
//       am5.Legend.new(root, {
//         centerX: am5.p50,
//         x: am5.p50,
//       })
//     );

//     // Configure legend items
//     legend.labels.template.setAll({
//       fontSize: 9,
//       fontWeight: "400",
//     });

//     legend.markers.template.setAll({
//       width: 8,
//       height: 8,
//     });

//     legend.data.setAll(chart.series.values);

//     return () => {
//       if (zoneChartRootRef.current) {
//         zoneChartRootRef.current.dispose();
//         zoneChartRootRef.current = null;
//       }
//     };
//   }, [transformLocationBarData]);

//   // Create pie chart for zone distribution
//   useEffect(() => {
//     const pieData = transformZoneDataForPie();
    
//     if (!pieChartRef.current || pieData.length === 0) {
//       if (pieChartRootRef.current) {
//         pieChartRootRef.current.dispose();
//         pieChartRootRef.current = null;
//       }
//       return;
//     }

//     if (pieChartRootRef.current) {
//       pieChartRootRef.current.dispose();
//     }

//     const root = am5.Root.new(pieChartRef.current);
//     pieChartRootRef.current = root;

//     root._logo?.dispose();
//     root.setThemes([am5themes_Animated.new(root)]);

//     const chart = root.container.children.push(
//       am5percent.PieChart.new(root, {
//         layout: root.verticalLayout,
//       })
//     );

//     // Define custom colors for pie chart
//     const pieColors = ["#EEA727", "#D02752", "#4D2B8C"];

//     const series = chart.series.push(
//       am5percent.PieSeries.new(root, {
//         valueField: "value",
//         categoryField: "category",
//         alignLabels: false,
//       })
//     );

//     // Apply custom colors to slices using adapter
//     series.slices.template.adapters.add("fill", (fill, target) => {
//       const dataItem = target.dataItem;
//       if (dataItem) {
//         const index = (dataItem as any).index;
//         if (index !== undefined && index >= 0) {
//           return am5.color(pieColors[index % pieColors.length]);
//         }
//       }
//       return fill;
//     });

//     // Configure tooltip to show distinct_fan_count
//     series.slices.template.adapters.add("tooltipText", (text, target) => {
//       const dataContext = target.dataItem?.dataContext as { category: string; value: number };
//       if (dataContext) {
//         return `${dataContext.category}\ndistinct_fan_count: ${dataContext.value}`;
//       }
//       return text;
//     });

//     series.slices.template.setAll({
//       cursorOverStyle: "pointer",
//       stroke: am5.color(0xffffff),
//       strokeWidth: 0,
//     });

//     series.labels.template.setAll({
//       textType: "circular",
//       centerX: 0,
//       centerY: 0,
//       fontSize: 12,
//       text: "{category}",
//     });

//     series.ticks.template.setAll({
//       forceHidden: true,
//     });

//     series.data.setAll(pieData);

//     // Apply colors to each slice after data is set
//     series.dataItems.forEach((dataItem, index) => {
//       const slice = dataItem.get("slice");
//       if (slice) {
//         slice.set("fill", am5.color(pieColors[index % pieColors.length]));
//       }
//     });

//     series.appear(1000, 100);

//     return () => {
//       if (pieChartRootRef.current) {
//         pieChartRootRef.current.dispose();
//         pieChartRootRef.current = null;
//       }
//     };
//   }, [transformZoneDataForPie]);

//   // Get column headers from data
//   const getColumnHeaders = () => {
//     if (!data || data.length === 0) return [];
//     return Object.keys(data[0]);
//   };

//   // Format header name (convert snake_case to Title Case)
//   const formatHeaderName = (key: string): string => {
//     return key
//       .split('_')
//       .map(word => word.charAt(0).toUpperCase() + word.slice(1))
//       .join(' ');
//   };

//   // Format cell value
//   const formatCellValue = (value: any): string => {
//     if (value === null || value === undefined) return '-';
//     if (typeof value === 'boolean') return value ? 'Yes' : 'No';
//     if (typeof value === 'object') return JSON.stringify(value);
//     return String(value);
//   };

//   const isTruckList = (value: any, key?: string): value is Record<string, any>[] => {
//     if (!Array.isArray(value)) return false;
//     if (key && key.toLowerCase().includes('truck')) return true;
//     return value.some(
//       (item) =>
//         item &&
//         typeof item === 'object' &&
//         ('truck_number' in item || 'truck' in item || 'assigned_bay' in item || 'reassigned_bay' in item)
//     );
//   };

//   const handleTruckCountClick = (rowIndex: number, key: string) => {
//     const row = filteredData[rowIndex];
//     const value = row?.[key];
//     if (!isTruckList(value, key)) return;

//     const headers = Array.from(
//       new Set(
//         (value as any[]).reduce<string[]>((keys, obj) => {
//           if (obj && typeof obj === 'object') {
//             Object.keys(obj).forEach((k) => {
//               if (!keys.includes(k)) keys.push(k);
//             });
//           }
//           return keys;
//         }, [])
//       )
//     );

//     setDetailDialogData({
//       title: `${formatHeaderName(key)} (${value.length} truck${value.length === 1 ? '' : 's'})`,
//       headers,
//       rows: value,
//     });
//     setIsDetailDialogOpen(true);
//   };

//   // Filter and sort data - show top 10 by Reassign Count
//   const filterData = (data: BayReassignmentData[]) => {
//     let filtered = data;

//     // Apply zone filter if a zone bar is selected
//     if (selectedZoneBar) {
//       filtered = filtered.filter(item => {
//         const zoneValue = item.zone || '';
//         return String(zoneValue).toUpperCase() === selectedZoneBar.toUpperCase();
//       });
//     }

//     // Apply location filter if a specific location is selected (dropdown)
//     if (selectedLocationFilter !== 'all') {
//       filtered = filtered.filter(item => {
//         const locationValue = item.location_name || item.location || item.name || '';
//         return String(locationValue).toLowerCase() === selectedLocationFilter.toLowerCase();
//       });
//     }

//     // Apply search filter if search term exists
//     if (searchTerm.trim()) {
//       const searchLower = searchTerm.toLowerCase();
//       filtered = filtered.filter(item => {
//         return Object.values(item).some(value => {
//           const stringValue = formatCellValue(value).toLowerCase();
//           return stringValue.includes(searchLower);
//         });
//       });
//     }

//     // Find the column that contains reassign count
//     const reassignCountKeys = ['reassign_count', 'total_reassign_count', 'reassigncount', 'count'];
//     let countKey: string | null = null;
    
//     if (filtered.length > 0) {
//       const keys = Object.keys(filtered[0]);
//       countKey = keys.find(key => 
//         reassignCountKeys.some(reassignKey => 
//           key.toLowerCase().includes(reassignKey.toLowerCase())
//         )
//       ) || null;
//     }

//     // Sort by reassign count (descending) and take top 10
//     if (countKey) {
//       filtered = [...filtered].sort((a, b) => {
//         const aValue = Number(a[countKey!]) || 0;
//         const bValue = Number(b[countKey!]) || 0;
//         return bValue - aValue;
//       }).slice(0, 10);
//     }
//     return filtered;
//   };

//   const filteredData = filterData(data);
//   const columnHeaders = getColumnHeaders();

//   // Data for table next to bar chart (only when a location bar is selected)
//   const locationTableData = React.useMemo(() => {
//     if (!selectedLocationBar || !data?.length) return [];
//     return data
//       .filter(
//         (item) =>
//           String(item.location_name || item.location || item.name || '').toLowerCase() ===
//           selectedLocationBar.toLowerCase()
//       )
//       .sort((a, b) => {
//         const truckA = (a.truck_number || '').toLowerCase();
//         const truckB = (b.truck_number || '').toLowerCase();
//         if (truckA !== truckB) return truckA.localeCompare(truckB);
//         return String(a.fan_number || '').localeCompare(String(b.fan_number || ''));
//       });
//   }, [data, selectedLocationBar]);

//   return (
//     <div className="min-h-screen bg-gray-50 p-1">
//       <div className="max-w-[1920px] mx-auto space-y-1">
//         {/* Bar Chart for Zone-based Reassignments */}
//         <Card className="bg-white rounded-lg shadow-sm border space-y-0">
//           <CardHeader className="border-b p-2">
//             <div className="flex justify-between items-center">
//               <CardTitle className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
//                 Reassignment Analytics by Location
//               </CardTitle>
//             </div>
//           </CardHeader>
//           <CardContent className="p-1">
//             {isLoading ? (
//               <div className="flex items-center justify-center" style={{ height: '320px' }}>
//                 <div className="flex items-center justify-center gap-2">
//                   <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#1e88e5' }} />
//                   <span className="text-gray-500 font-medium">Loading chart data...</span>
//                 </div>
//               </div>
//             ) : (selectedLocationBar ? transformDrillDownBarData() : transformLocationBarData()).length > 0 ? (
//               <div className="flex gap-4 h-80 items-center justify-start">
//                 {/* Bar Chart - Left side */}
//                 <div className="w-2/5 h-full flex items-center justify-center">
//                   <div ref={zoneChartRef} className="w-full h-full"></div>
//                 </div>
//                 {/* Table next to bar chart - only when a location bar is selected */}
//                 {selectedLocationBar && locationTableData.length > 0 && (
//                   <div className="flex-1 min-w-0 max-w-md h-full flex flex-col border rounded-lg overflow-hidden" style={{ borderColor: '#1e88e5' }}>
//                     <div className="px-3 py-2 flex items-center justify-between gap-2 shrink-0 bg-gray-50 border-b" style={{ borderColor: '#1e88e540' }}>
//                       <span className="text-sm text-gray-600">
//                         Filtered by: <span className="font-medium text-blue-600">{selectedLocationBar}</span>
//                       </span>
//                       <button
//                         onClick={() => setSelectedLocationBar(null)}
//                         className="text-xs text-gray-500 hover:text-gray-700 underline whitespace-nowrap"
//                       >
//                         Clear filter
//                       </button>
//                     </div>
//                     <div className="px-3 py-2 text-xs font-semibold text-white shrink-0" style={{ background: '#1e88e5' }}>
//                       {selectedLocationBar} — Trucks & Fans
//                     </div>
//                     <div className="flex-1 overflow-auto min-h-0">
//                       <table className="w-full text-xs border-collapse">
//                         <thead className="sticky top-0 bg-gray-100">
//                           <tr>
//                             <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b">Truck</th>
//                             <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b">Fan</th>
//                             <th className="px-2 py-1.5 text-right font-semibold text-gray-700 border-b">Count</th>
//                           </tr>
//                         </thead>
//                         <tbody>
//                           {locationTableData.map((row, idx) => (
//                             <tr key={idx} className="border-b border-gray-100 hover:bg-blue-50/50">
//                               <td className="px-2 py-1.5 text-gray-800">{formatCellValue(row.truck_number)}</td>
//                               <td className="px-2 py-1.5 text-gray-800">{formatCellValue(row.fan_number)}</td>
//                               <td className="px-2 py-1.5 text-right text-gray-800">{formatCellValue(row.distinct_fan_count)}</td>
//                             </tr>
//                           ))}
//                         </tbody>
//                       </table>
//                     </div>
//                   </div>
//                 )}
//                 {/* Pie Chart - Right side */}
//                 <div className="w-1/3 h-full flex flex-col items-center justify-center ml-auto">
//                   {/* Pie Chart Toggle - Just above pie chart, aligned right */}
//                   <div className="flex items-center gap-2 mb-2 self-end">
//                     {/* <span className="text-sm text-gray-600">Pie Chart View:</span> */}
//                     <div className="flex bg-gray-100 rounded-lg p-0.5">
//                       <button
//                         onClick={() => setPieChartDrillState("zone")}
//                         className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
//                           pieChartDrillState === "zone"
//                             ? "bg-white text-gray-900 shadow-sm"
//                             : "text-gray-600 hover:text-gray-900"
//                         }`}
//                       >
//                         Zone
//                       </button>
//                       <button
//                         onClick={() => setPieChartDrillState("plant")}
//                         className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
//                           pieChartDrillState === "plant"
//                             ? "bg-white text-gray-900 shadow-sm"
//                             : "text-gray-600 hover:text-gray-900"
//                         }`}
//                       >
//                         Plant
//                       </button>
//                     </div>
//                   </div>
//                   <div ref={pieChartRef} className="w-full h-full max-w-xs"></div>
//                 </div>
//               </div>
//             ) : (
//               <div className="flex items-center justify-center" style={{ height: '320px' }}>
//                 <p className="text-gray-500 font-medium">No chart data available</p>
//               </div>
//             )}
//           </CardContent>
//         </Card>

//       {/* Error State */}
//       {error && !isLoading && (
//         <div className="text-center py-8">
//           <p className="text-red-600 text-sm font-medium">{error}</p>
//         </div>
//       )}

//       {/* Bay Reassignment Data Table */}
//       {!error && (
//         <Card className="bg-white rounded-lg shadow-sm border space-y-0">
//           {/* <CardHeader className="border-b p-2">
//             <CardTitle className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
//               Bay Reassignment Data
//             </CardTitle>
//             <div className="mb-4 flex items-center gap-2 min-w-0">
//               <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Location:</span>
//               <div className="relative w-64">
//                 <Select value={selectedLocationFilter} onValueChange={setSelectedLocationFilter}>
//                   <SelectTrigger className="w-full">
//                     <SelectValue placeholder="All Locations" />
//                   </SelectTrigger>
//                   <SelectContent>
//                     <SelectItem value="all">All Locations</SelectItem>
//                     {plantData.map((plant) => (
//                       <SelectItem key={plant.id} value={plant.name}>
//                         {plant.name}
//                       </SelectItem>
//                     ))}
//                   </SelectContent>
//                 </Select>
//                 {selectedLocationFilter !== 'all' && (
//                   <button
//                     type="button"
//                     onClick={() => setSelectedLocationFilter('all')}
//                     className="absolute right-8 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
//                     title="Clear location filter"
//                   >
//                     <XCircle className="h-4 w-4 text-gray-400 hover:text-gray-600" />
//                   </button>
//                 )}
//               </div>
//             </div>
//           </CardHeader> */}
//           <CardHeader className="border-b p-2">
//   <div className="flex items-center justify-between gap-4">
//     {/* Title */}
//     <CardTitle className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
//       Bay Reassignment Data
//     </CardTitle>

//     {/* Location Filter (moved to end/right) */}
//     <div className="flex items-center gap-2 mr-4">

//       <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
//         Location:
//       </span>
//       <div className="relative w-64">
//         <Select value={selectedLocationFilter} onValueChange={setSelectedLocationFilter}>
//           <SelectTrigger className="w-full">
//             <SelectValue placeholder="All Locations" />
//           </SelectTrigger>
//           <SelectContent>
//             <SelectItem value="all">All Locations</SelectItem>
//             {plantData.map((plant) => (
//               <SelectItem key={plant.id} value={plant.name}>
//                 {plant.name}
//               </SelectItem>
//             ))}
//           </SelectContent>
//         </Select>

//         {selectedLocationFilter !== 'all' && (
//           <button
//             type="button"
//             onClick={() => setSelectedLocationFilter('all')}
//             className="absolute right-8 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
//             title="Clear location filter"
//           >
//             <XCircle className="h-4 w-4 text-gray-400 hover:text-gray-600" />
//           </button>
//         )}
//       </div>
//     </div>
//   </div>
// </CardHeader>

//           <CardContent className="p-1">
//             <div className="mb-4">
//               <div className="relative w-full">
//                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
//                   <Search className="h-4 w-4 text-gray-400" />
//                 </div>
//                 <input
//                   type="text"
//                   value={searchTerm}
//                   onChange={(e) => setSearchTerm(e.target.value)}
//                   placeholder="Search table records..."
//                   disabled={isLoading}
//                   className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm bg-white disabled:bg-gray-100 disabled:cursor-not-allowed shadow-sm"
//                 />
//                 {searchTerm && !isLoading && (
//                   <button
//                     type="button"
//                     onClick={() => setSearchTerm("")}
//                     className="absolute inset-y-0 right-0 pr-3 flex items-center hover:bg-gray-100 rounded-r-lg transition-colors"
//                   >
//                     <XCircle className="h-4 w-4 text-gray-400 hover:text-gray-600" />
//                   </button>
//                 )}
//               </div>
//             </div>
//             <div className="border overflow-hidden bg-white" style={{ borderColor: '#1e88e5' }}>
//           <div className="overflow-x-auto overflow-y-auto max-h-[500px] relative">
//             <table className="w-max min-w-full divide-y relative" style={{ '--divider-color': '#1e88e5' } as React.CSSProperties}>
//               <thead className="sticky top-0 z-10" style={{ background: '#1e88e5' }}>
//                 <tr>
//                   {columnHeaders.map((header) => (
//                     <th
//                       key={header}
//                       className="px-6 py-3 text-left text-sm font-bold text-white uppercase tracking-wider whitespace-nowrap"
//                     >
//                       {formatHeaderName(header)}
//                     </th>
//                   ))}
//                 </tr>
//               </thead>
//               <tbody className="bg-white" style={{ '--divider-color': '#1e88e540' } as React.CSSProperties}>
//                 {isLoading ? (
//                   <tr>
//                     <td colSpan={columnHeaders.length} className="px-4 py-8 text-center">
//                       <div className="flex items-center justify-center gap-2">
//                         <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#1e88e5' }} />
//                         <span className="text-gray-500 font-medium">Loading Bay Reassignment data...</span>
//                       </div>
//                     </td>
//                   </tr>
//                 ) : filteredData.length > 0 ? (
//                   filteredData.map((item, index) => (
//                     <tr
//                       key={index}
//                       className="transition-colors hover:[background-color:#1e88e510]"
//                       style={{ borderBottom: '1px solid #1e88e540' }}
//                     >
//                       {columnHeaders.map((header) => {
//                         const value = item[header];
//                         if (isTruckList(value, header)) {
//                           const countLabel = `${value.length} truck${value.length === 1 ? '' : 's'}`;
//                           return (
//                             <td key={header} className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
//                               <button
//                                 onClick={() => handleTruckCountClick(index, header)}
//                                 className="hover:underline font-medium cursor-pointer hover:[color:#1976d2]"
//                                 style={{ color: '#1e88e5' }}
//                               >
//                                 {countLabel}
//                               </button>
//                             </td>
//                           );
//                         }
//                         return (
//                           <td key={header} className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
//                             {formatCellValue(value)}
//                           </td>
//                         );
//                       })}
//                     </tr>
//                   ))
//                 ) : (
//                   <tr>
//                     <td colSpan={columnHeaders.length} className="px-4 py-6 text-center">
//                       <p className="text-gray-600 font-medium">
//                         {data.length > 0 ? 'No data found matching your search' : 'No data available'}
//                       </p>
//                     </td>
//                   </tr>
//                 )}
//               </tbody>
//             </table>
//           </div>
//             </div>
//           </CardContent>
//         </Card>
//       )}

//       {/* Truck Details Dialog */}
//       <Dialog
//         open={isDetailDialogOpen}
//         onOpenChange={(open) => {
//           setIsDetailDialogOpen(open);
//           if (!open) setDetailDialogData(null);
//         }}
//       >
//         <DialogContent className="sm:max-w-[800px]">
//           <DialogHeader className="pb-3">
//             <DialogTitle className="text-lg font-bold text-gray-900">
//               {detailDialogData?.title || 'Truck Details'}
//             </DialogTitle>
//           </DialogHeader>
//           {detailDialogData ? (
//             <div className="border overflow-hidden shadow-sm bg-white rounded-lg" style={{ borderColor: '#1e88e5' }}>
//               <div className="overflow-x-auto max-h-80 overflow-y-auto">
//                 <table className="w-full">
//                   <thead className="bg-gray-100">
//                     <tr>
//                       {detailDialogData.headers.map((detailKey) => (
//                         <th
//                           key={detailKey}
//                           className="px-6 py-3 text-left text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-300 whitespace-nowrap"
//                         >
//                           {formatHeaderName(detailKey)}
//                         </th>
//                       ))}
//                     </tr>
//                   </thead>
//                   <tbody className="bg-white">
//                     {detailDialogData.rows.map((truck: any, idx: number) => (
//                       <tr key={idx} className="border-b border-gray-200">
//                         {detailDialogData.headers.map((detailKey) => (
//                           <td key={detailKey} className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">
//                             {formatCellValue(truck?.[detailKey])}
//                           </td>
//                         ))}
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>
//             </div>
//           ) : (
//             <p className="text-sm text-gray-600">No truck details available.</p>
//           )}
//         </DialogContent>
//       </Dialog>
//       </div>
//     </div>
//   );
// };

// export default BayReassignment;



