import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { Calendar, FileCog, Filter, Clock, CheckCircle } from 'lucide-react';
import { apiClient } from "@/services/apiClient";
import DataGrid from '@/components/common/DataGrid';

interface PanelCleaningImpactProps {
  zone?: string[] | string;
  timeFilter?: string | null | { key: string; cond: string; value: string };
  refreshKey?: number;
  bu?: string;
  plant?: string | null;
  selectedLocation?: string | null;
}

interface CleaningDataPoint {
  date: number;
  dateStr?: string; // Store original date string for exact matching
  dateLabel: string;
  efficiency: number;
  generation: number;
  isCleaningDay: boolean;
  cleaningType: 'dry' | 'wet' | null;
}

// Status pill renderer: colored background only wraps the text (narrow width)
const StatusCellRenderer = (props: any) => {
  const status = String(props.value ?? props.data?.panel_status ?? '').toLowerCase();
  const isCompleted = status === 'completed';
  const isPending = status === 'pending';
  const bg = isCompleted ? '#dcfce7' : isPending ? '#ffedd5' : '#fee2e2';
  const fg = isCompleted ? '#166534' : isPending ? '#9a3412' : '#991b1b';
  const text = props.value ?? props.data?.panel_status ?? 'N/A';
  return (
    <span
      style={{
        backgroundColor: bg,
        color: fg,
        borderRadius: '9999px',
        padding: '1px 6px',
        fontWeight: 600,
        fontSize: '11px',
        lineHeight: 1.2,
        display: 'inline-block',
      }}
    >
      {text}
    </span>
  );
};

const PanelCleaningImpact: React.FC<PanelCleaningImpactProps> = ({ zone, timeFilter, refreshKey = 0, bu = 'SOD', plant = null, selectedLocation = null }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const lastPanelStatusRequestKeyRef = useRef<string>('');
  const lastCleaningDataRequestKeyRef = useRef<string>('');
  const [cleaningType, setCleaningType] = useState<'dry' | 'wet'>('dry');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [cleaningData, setCleaningData] = useState<CleaningDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cleaningRecords, setCleaningRecords] = useState<Array<{ 
    cleaning_date?: string; 
    last_cleaning_date?: string; 
    cleaning_type?: string;
    location?: string;
    zone?: string;
    sap_id?: string;
    bu?: string;
    date?: string;
    cleaned_date?: string;
    [key: string]: any; // Allow additional fields from API
  }>>([]);
  
  // Pending/Completed counts state
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [pendingDetails, setPendingDetails] = useState<Array<any>>([]);
  const [completedDetails, setCompletedDetails] = useState<Array<any>>([]);
  const [showPendingPopup, setShowPendingPopup] = useState(false);
  const [showCompletedPopup, setShowCompletedPopup] = useState(false);
  const [pendingSearchTerm, setPendingSearchTerm] = useState('');
  const [completedSearchTerm, setCompletedSearchTerm] = useState('');
  const [pendingCurrentPage, setPendingCurrentPage] = useState(1);
  const [completedCurrentPage, setCompletedCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Dynamic table height: min 2 rows, grow with data, cap at 10 visible rows
  const TABLE_HEADER_HEIGHT = 40;
  const TABLE_ROW_HEIGHT = 36;
  const TABLE_MIN_VISIBLE_ROWS = 4;
  const TABLE_MAX_VISIBLE_ROWS = 20;
  const pendingTableHeight = TABLE_HEADER_HEIGHT + Math.max(TABLE_MIN_VISIBLE_ROWS, Math.min(pendingDetails.length, TABLE_MAX_VISIBLE_ROWS)) * TABLE_ROW_HEIGHT;
  const completedTableHeight = TABLE_HEADER_HEIGHT + Math.max(TABLE_MIN_VISIBLE_ROWS, Math.min(completedDetails.length, TABLE_MAX_VISIBLE_ROWS)) * TABLE_ROW_HEIGHT;
  
  // Form state for popup
  const [formBU, setFormBU] = useState<string>('SOD');
  const [formZone, setFormZone] = useState<string>(() => {
    if (zone) {
      return Array.isArray(zone) ? zone[0] || '' : zone;
    }
    return '';
  });
  const [formPlant, setFormPlant] = useState<string>(plant || '');
  const [formDate, setFormDate] = useState<string>('');
  const [plantOptions, setPlantOptions] = useState<Array<{ name: string; id: string }>>([]);
  const [isLoadingPlants, setIsLoadingPlants] = useState(false);
  
  // Common zones list
  const zoneOptions = ['NZ', 'NCZ', 'NWZ', 'WZ', 'CZ', 'EZ', 'ECZ', 'NFZ', 'NWF', 'SCZ', 'SWZ', 'SZ'];
  const buOptions = ['SOD', 'TAS'];

  // Completed Cleaning Details - DataGrid column definitions
  const completedDetailsColumnDefs = useMemo(() => [
    { headerName: 'BU', field: 'bu', minWidth: 80 },
    { headerName: 'SAP ID', field: 'sap_id', minWidth: 100 },
    { headerName: 'Location', field: 'location', minWidth: 120 },
    { headerName: 'Zone', field: 'zone', minWidth: 80 },
    { headerName: 'Cleaning Type', field: 'cleaning_type', minWidth: 120 },
    { headerName: 'Frequency', field: 'frequency', minWidth: 100 },
    { headerName: 'Cleaning Date', field: 'cleaning_date', minWidth: 120 },
    { headerName: 'Last Cleaning Date', field: 'last_cleaning_date', minWidth: 130 },
    {
      headerName: 'Status',
      field: 'panel_status',
      minWidth: 100,
      valueGetter: (params: any) => params.data?.panel_status || 'N/A',
      cellRenderer: StatusCellRenderer,
    },
  ], []);


  const pendingDetailsColumnDefs = useMemo(() => [
    { headerName: 'BU', field: 'bu', minWidth: 80 },
    { headerName: 'SAP ID', field: 'sap_id', minWidth: 100 },
    { headerName: 'Location', field: 'location', minWidth: 120 },
    { headerName: 'Zone', field: 'zone', minWidth: 80 },
    { headerName: 'Cleaning Type', field: 'cleaning_type', minWidth: 120 },
    { headerName: 'Frequency', field: 'frequency', minWidth: 100 },
    { headerName: 'Last Cleaning Date', field: 'last_cleaning_date', minWidth: 130 },
    {
      headerName: 'Status',
      field: 'panel_status',
      minWidth: 100,
      valueGetter: (params: any) => params.data?.panel_status || 'N/A',
      cellRenderer: StatusCellRenderer,
    },
  ], []);

  const cleaningDetailsDefaultColDef = useMemo(() => ({
    flex: 0,
    resizable: true,
    sortable: true,
    filter: false,
    suppressMenu: true,
    cellStyle: { textAlign: 'center' as const },
  }), []);


  const [appliedZone, setAppliedZone] = useState<string | null>(zone ? (Array.isArray(zone) ? zone[0] : zone) : null);
  const [appliedPlant, setAppliedPlant] = useState<string | null>(plant);
 
  const [cardRefreshKey, setCardRefreshKey] = useState(0);


  const getDateFilterValue = (filter: string | null | { key: string; cond: string; value: string } | undefined): string => {
  
    if (filter && typeof filter === 'object' && 'key' in filter && 'value' in filter) {
   
      return filter.value;
    }

    // Handle string filters
    if (typeof filter === 'string') {
      const filterMap: { [key: string]: string } = {
        't': 't',           // Today
        'tdy': 't',         // Today (alternative)
        'TDY': 't',         // Today (uppercase)
        '1d': '1d',         // Yesterday
        'ydy': '1d',        // Yesterday (alternative)
        'YDY': '1d',        // Yesterday (uppercase)
        '1w': '1w',         // 1 Week
        '1W': '1w',         // 1 Week (uppercase)
        '15d': '15d',       // 15 Days
        '15D': '15d',       // 15 Days (uppercase)
        '1m': '1m',         // 1 Month
        '1M': '1m',         // 1 Month (uppercase)
        '3m': '3m',         // 3 Months
        '3M': '3m',         // 3 Months (uppercase)
        'custom': 'custom'  // Date Range
      };
      return filterMap[filter] || filterMap[filter.toLowerCase()] || filter; // Return mapped value or original filter
    }
    // Default to 1 month
    return '1m';
  };

  // Fetch cleaning records immediately on component mount and when filters change
  useEffect(() => {
    const fetchCleaningRecords = async () => {
      try {
        // Prefer props (zone/plant) over state so we don't send stale appliedZone/appliedPlant when user changes zone/plant
        const zoneValue = (zone != null ? (Array.isArray(zone) ? zone[0] : zone) : appliedZone) ?? '';
        const plantValue = (plant ?? appliedPlant) ?? '';
        
        // Build filters array
        const filters: any[] = [];
        
        // Add zone filter
        if (zoneValue) {
          filters.push({
            key: "zone",
            cond: "=",
            value: zoneValue.toUpperCase()
          });
        }
        
        // Add plant filter (BU Code)
        if (plantValue) {
          filters.push({
            key: "sap_id",
            cond: "=",
            value: plantValue
          });
        }
        
        // Add location filter
        if (selectedLocation) {
          filters.push({
            key: "location_name",
            cond: "=",
            value: selectedLocation
          });
        }
        
        // Add cleaning_type filter
        filters.push({
          key: "cleaning_type",
          cond: "=",
          value: cleaningType === 'dry' ? 'dry' : 'wet'
        });
        
        // Build payload for get_all_dry_wet_cleaning_records API - use header bu (source of truth), then formBU
        const buRaw = bu || formBU || '';
        const apiBU = buRaw === 'TAS' ? 'SOD' : (buRaw || 'SOD');
        const payload = {
          bu: apiBU,
          cleaning_type: cleaningType === 'dry' ? 'dry' : 'wet',
          filters: [
            { key: "bu", cond: "=", value: apiBU },
            ...filters,
          ],
          drill_state: "",
          cross_filters: [],
          limit: 0,
          time_grain: ""
        };
        
        const response = await apiClient.post('/api/solarpanelwetdrycleaning/get_all_dry_wet_cleaning_records', payload);
        
        let records: any[] = [];
        if (response?.data?.data && Array.isArray(response.data.data)) {
          records = response.data.data;
        } else if (response?.data?.status === true && response?.data?.data && Array.isArray(response.data.data)) {
          records = response.data.data;
        } else if (Array.isArray(response?.data)) {
          records = response.data;
        }
        setCleaningRecords(records);
      } catch (error) {
        console.error('Error fetching cleaning records:', error);
        setCleaningRecords([]);
      }
    };

    fetchCleaningRecords();
  }, [bu, zone, plant, cleaningType, selectedLocation, timeFilter, refreshKey, cardRefreshKey]); // cardRefreshKey: refresh on form submit

  // Fetch pending/completed counts
  useEffect(() => {
    const fetchPendingCompletedCounts = async () => {
      try {
        // Prefer props over state to avoid stale zone/plant when filter changes
        const zoneValue = (zone != null ? (Array.isArray(zone) ? zone[0] : zone) : appliedZone) ?? '';
        const plantValue = (plant ?? appliedPlant) ?? '';
        
        // Build filters array (NO date filter for this API)
        const filters: any[] = [];
        
        // Add zone filter
        if (zoneValue) {
          filters.push({
            key: "zone",
            cond: "=",
            value: zoneValue.toUpperCase()
          });
        }
        
        // Add plant filter (BU Code)
        if (plantValue) {
          filters.push({
            key: "sap_id",
            cond: "=",
            value: plantValue
          });
        }
        
        // Add location filter
        if (selectedLocation) {
          filters.push({
            key: "location_name",
            cond: "=",
            value: selectedLocation
          });
        }
        
        // Payload with cleaning_type from toggle (dry or wet) - use header bu (source of truth)
        // Note: Date filter is NOT included for this API
        const buRaw = bu || formBU || '';
        const apiBU = buRaw === 'TAS' ? 'SOD' : (buRaw || 'SOD');
        const payload = {
          bu: apiBU,
          cleaning_type: cleaningType, // "dry" or "wet" from toggle
          filters: [
            { key: "bu", cond: "=", value: apiBU },
            ...filters,
          ],
          drill_state: "",
          cross_filters: [],
          limit: 0,
          time_grain: ""
        };
        
        const response = await apiClient.post('/api/solarpanelwetdrycleaning/get_pending_completed_counts', payload);
        
        if (response?.data?.status === true && response.data.data) {
          const data = response.data.data;
          setPendingCount(data.pending?.count || 0);
          setCompletedCount(data.completed?.count || 0);
          setPendingDetails(data.pending?.details || []);
          setCompletedDetails(data.completed?.details || []);
        } else {
          // Reset counts if response is invalid
          setPendingCount(0);
          setCompletedCount(0);
          setPendingDetails([]);
          setCompletedDetails([]);
        }
      } catch (error) {
        console.error('Error fetching pending/completed counts:', error);
        setPendingCount(0);
        setCompletedCount(0);
        setPendingDetails([]);
        setCompletedDetails([]);
      }
    };

    fetchPendingCompletedCounts();
  }, [bu, zone, plant, cleaningType, timeFilter, selectedLocation, refreshKey, cardRefreshKey]); // cardRefreshKey: refresh on form submit

  const effectiveZone = (zone != null ? (Array.isArray(zone) ? zone[0] : zone) : appliedZone) ?? '';
  const effectivePlant = (plant ?? appliedPlant) ?? '';
  const buRawForApi = bu || formBU || '';
  const effectiveBU = buRawForApi === 'TAS' ? 'SOD' : (buRawForApi || 'SOD');
  const effectiveDateFilter = getDateFilterValue(timeFilter);

  // Fetch panel status - on initial load and when filters change
  useEffect(() => {
    const fetchPanelStatus = async () => {
      try {
        // Prefer props over state so payload uses current zone/plant (avoids stale CEN when user selected ECZ)
        const zoneValue = effectiveZone;
        const plantValue = effectivePlant;

        // Get plant name from plantOptions based on sap_id (plantValue)
        // If sap_id is provided, use the corresponding plant name as location
        let locationValue = selectedLocation ? String(selectedLocation) : '';
        if (plantValue && plantOptions.length > 0) {
          const foundPlant = plantOptions.find(p => p.id === plantValue);
          if (foundPlant) {
            locationValue = foundPlant.name;
          }
        }

        // Build payload for get_panel_status API - use header bu (source of truth)
        // Header stores SOD as "TAS"; API expects "SOD" when user selected SOD
        const payload = {
          bu: effectiveBU,
          sap_id: plantValue || '',
          location: locationValue,
          zone: zoneValue || '',
          cleaning_type: cleaningType || ''
        };

        const requestKey = JSON.stringify(payload);
        if (lastPanelStatusRequestKeyRef.current === requestKey) return;
        lastPanelStatusRequestKeyRef.current = requestKey;

        const response = await apiClient.post('/api/solarpanelwetdrycleaning/get_panel_status', payload);

        // Handle response as needed (e.g. store panel status data in state if needed)
        if (response?.data) {
          // Optional: set state for panel status data
        }
      } catch (error) {
        console.error('Error fetching panel status:', error);
      }
    };

    fetchPanelStatus();
  }, [effectiveZone, effectivePlant, effectiveBU, cleaningType, selectedLocation, refreshKey]); // panel status refreshed first in submit handler, not via cardRefreshKey

  // Fetch plants when zone is selected - using same API as ZonePlantSelections
  useEffect(() => {
    const fetchPlants = async () => {
      // Use zone prop only so we run once per zone change (formZone would trigger a second run after sync effect)
      const zoneToUse = zone != null ? (Array.isArray(zone) ? zone[0] : zone) : '';
      
      if (zoneToUse) {
        try {
          setIsLoadingPlants(true);
          // Use TAS for API call (same as top filter) - SOD is converted to TAS
          const apiBU = bu === 'SOD' ? 'TAS' : (bu || 'TAS');
          
          // Use same payload structure as ZonePlantSelections
          const payload = {
            bu: apiBU,
            zone: zoneToUse !== "all" ? [zoneToUse] : [],
            plant: []
          };
          
          const response = await apiClient.post('/api/indentdryout/get_distinct_location_details', payload);

          if (response?.data?.status === true && response.data.data?.plant) {
            // Use same structure as ZonePlantSelections - response.data.data.plant is already an array of {name, id}
            const sortedPlants = [...response.data.data.plant].sort((a, b) =>
              a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
            );
            
            setPlantOptions(sortedPlants);
          } else {
            setPlantOptions([]);
          }
        } catch (error) {
          console.error('Error fetching plants:', error);
          setPlantOptions([]);
        } finally {
          setIsLoadingPlants(false);
        }
      } else {
        setPlantOptions([]);
        setFormPlant('');
      }
    };

    fetchPlants();
  }, [zone, bu]); // Only zone and bu – no formZone/formBU to avoid double call when sync effect runs after zone change

  // Update form values and applied filters when props change
  useEffect(() => {
    if (zone) {
      const zoneValue = Array.isArray(zone) ? zone[0] || '' : zone;
      setFormZone(zoneValue);
      // Also update appliedZone to sync with top filter
      setAppliedZone(zoneValue);
    } else {
      // Clear zone when prop is null/undefined
      setFormZone('');
      setAppliedZone(null);
    }
    // Sync formBU from parent BU (e.g. LPG when user selects LPG in header)
    setFormBU(bu || 'SOD');
    // Update formPlant and appliedPlant when plant prop changes (including when it becomes null/undefined)
    if (plant) {
      setFormPlant(plant);
      setAppliedPlant(plant);
    } else {
      // Clear formPlant when plant prop is null/undefined (unselected)
      setFormPlant('');
      setAppliedPlant(null);
    }
  }, [zone, plant, bu]);

  const fetchCleaningData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Prefer props over state so we use current zone/plant when user changes filter
      const zoneValue = effectiveZone;
      const plantValue = effectivePlant;
      const apiBU = effectiveBU;
      const payload = {
        "bu": apiBU,
        "action": "get_efficiency_last_30_days",
        "filters": [
          {"key":"bu","cond":"=","value": apiBU},
          {"key":"timestamp_ist","cond":"date_filter","value": effectiveDateFilter},
          ...(zoneValue ? [{"key":"zone","cond":"=","value": zoneValue.toUpperCase()}] : []),
          ...(plantValue ? [{"key":"sap_id","cond":"=","value": plantValue}] : []),
          ...(selectedLocation ? [{"key":"location_name","cond":"=","value": selectedLocation}] : [])
        ],
        "drill_state": "",
        "cross_filters": [],
        "limit": 0,
        "time_grain": "",
        "category": ""
      };

      const response = await apiClient.post('/api/solarpanelcleaning/get_solar_dashboard_summary', payload);

      if (response && response.data && response.data.status === 'success' && response.data.data) {
        // Transform API response to chart data format
        const apiData = response.data.data;

        // Calculate average efficiency to identify cleaning days (days with significantly higher efficiency)
        const efficiencies = apiData.map((item: any) => parseFloat(item.efficiency || 0)).filter((val: number) => !isNaN(val));
        const avgEfficiency = efficiencies.length > 0 ? efficiencies.reduce((a: number, b: number) => a + b, 0) / efficiencies.length : 0;
        const threshold = avgEfficiency * 2; // Days with efficiency > 2x average are likely cleaning days

        const transformedData: CleaningDataPoint[] = apiData
          .filter((item: any) => item && item.date)
          .map((item: any) => {
            // Parse date from "YYYY-MM-DD" format
            const dateStr = item.date;
            const date = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();

            // Get efficiency and generation values directly from API
            const efficiency = parseFloat(item.efficiency || 0);
            const generation = parseFloat(item.generation || 0);

            // Determine if this is a cleaning day - days with efficiency significantly above average
            const isCleaningDay = !isNaN(efficiency) && efficiency > threshold && efficiency > 50;

            return {
              date: date.getTime(),
              dateStr: dateStr, // Store original date string for exact matching
              dateLabel: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              efficiency: isNaN(efficiency) ? 0 : efficiency,
              generation: isNaN(generation) ? 0 : generation,
              isCleaningDay: isCleaningDay,
              cleaningType: isCleaningDay ? cleaningType : null,
            };
          })
          .filter((item: CleaningDataPoint) => !isNaN(item.date)); // Remove invalid dates

        // Sort by date to ensure chronological order
        transformedData.sort((a, b) => a.date - b.date);

        setCleaningData(transformedData);
      } else {
        // Fallback to empty data if API response is invalid
        setCleaningData([]);
      }
    } catch (error) {
      console.error('Failed to fetch cleaning impact data:', error);
      setCleaningData([]);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveDateFilter, effectiveZone, effectivePlant, effectiveBU, selectedLocation, cleaningType]);

  // Fetch cleaning impact data from API (including initial mount and post-sync state changes)
  useEffect(() => {
    // Clear data immediately when plant or other filters change
    setCleaningData([]);
    const requestKey = JSON.stringify({
      zone: effectiveZone,
      plant: effectivePlant,
      bu: effectiveBU,
      location: selectedLocation || '',
      cleaningType,
      dateFilter: effectiveDateFilter,
      refreshKey,
      cardRefreshKey,
    });
    if (lastCleaningDataRequestKeyRef.current === requestKey) return;
    lastCleaningDataRequestKeyRef.current = requestKey;
    fetchCleaningData();
  }, [fetchCleaningData, effectiveZone, effectivePlant, effectiveBU, selectedLocation, cleaningType, effectiveDateFilter, refreshKey, cardRefreshKey]);

  // Reset pagination when search term changes
  useEffect(() => {
    setPendingCurrentPage(1);
  }, [pendingSearchTerm]);

  useEffect(() => {
    setCompletedCurrentPage(1);
  }, [completedSearchTerm]);

  // Reset pagination when popup closes
  useEffect(() => {
    if (!showPendingPopup) {
      setPendingCurrentPage(1);
      setPendingSearchTerm('');
    }
  }, [showPendingPopup]);

  useEffect(() => {
    if (!showCompletedPopup) {
      setCompletedCurrentPage(1);
      setCompletedSearchTerm('');
    }
  }, [showCompletedPopup]);

  useEffect(() => {
    // Dispose previous chart when plant changes or when loading starts
    if (rootRef.current) {
      rootRef.current.dispose();
      rootRef.current = null;
    }
    
    if (!chartRef.current || isLoading || cleaningData.length === 0) return;

    const root = am5.Root.new(chartRef.current);
    rootRef.current = root;
    root.setThemes([am5themes_Animated.new(root)]);
    root._logo?.dispose();

    // Create chart
    // const chart = root.container.children.push(
    //   am5xy.XYChart.new(root, {
    //     panX: false,
    //     panY: false,
    //     wheelX: 'panX',
    //     wheelY: 'zoomX',
    //     layout: root.verticalLayout,
    //   })
    // );

    // Create chart
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: false,
        wheelX: 'zoomX',
        wheelY: 'none',
        layout: root.verticalLayout,
        paddingTop: 10,
        paddingBottom: 25,
        paddingLeft: 60,
        paddingRight: 20,
      })
    );

    // Remove chart background
    chart.plotContainer.set('background', am5.Rectangle.new(root, {
      fillOpacity: 0
    }));
    // Create axes
    const xAxis = chart.xAxes.push(
      am5xy.DateAxis.new(root, {
        baseInterval: { timeUnit: 'day', count: 1 },
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 30,
          cellStartLocation: 0.1,
          cellEndLocation: 0.9,
        }),
        tooltip: am5.Tooltip.new(root, {}),
        dateFormats: {
          day: "MMM d, yyyy",
          week: "MMM d, yyyy",
          month: "MMM yyyy",
          year: "yyyy"
        },
        periodChangeDateFormats: {
          day: "MMM d, yyyy",
          week: "MMM d, yyyy",
          month: "MMM yyyy",
          year: "yyyy"
        }
      })
    );

    // Configure x-axis appearance
    const xRenderer = xAxis.get('renderer');
    xRenderer.labels.template.setAll({
      fontSize: 9,
      fill: am5.color('#475569'),
      rotation: -45,
      centerY: am5.p100,
      centerX: am5.p50,
      dy: 5,
      fontWeight: '600',
    });

    // Show x-axis line by setting stroke on the renderer
    xRenderer.setAll({
      stroke: am5.color('#cbd5e1'),
      strokeWidth: 1.5,
      strokeOpacity: 1,
    });

    // Add horizontal scrollbar for date navigation - positioned at bottom
    // Set initial range to show half of the data
    const scrollbarX = am5.Scrollbar.new(root, {
      orientation: 'horizontal',
      marginBottom: 0,
      marginTop: 0,
      height: 15,
      start: 0,
      end: 0.5, // Show first half of data initially
    });

    // Style the scrollbar - minimal, no fill color
    scrollbarX.get('background')?.setAll({
      fill: am5.color('#f1f5f9'),
      fillOpacity: 0.5,
      stroke: am5.color('#cbd5e1'),
      strokeWidth: 0.5,
    });

    scrollbarX.thumb.setAll({
      fill: am5.color('#94a3b8'),
      fillOpacity: 0.8,
    });

    scrollbarX.startGrip.get('background')?.setAll({
      fill: am5.color('#94a3b8'),
      fillOpacity: 0.8,
    });

    scrollbarX.endGrip.get('background')?.setAll({
      fill: am5.color('#94a3b8'),
      fillOpacity: 0.8,
    });

    // Manually add scrollbar to bottom container to ensure it's at the bottom
    chart.set('scrollbarX', scrollbarX);
    chart.bottomAxesContainer.children.push(scrollbarX);

    // Link scrollbar to xAxis for zooming
    scrollbarX.events.on('rangechanged', (ev) => {
      const start = ev.target.get('start', 0);
      const end = ev.target.get('end', 1);
      xAxis.zoom(start, end);
    });

    // Set initial zoom to show first half of data (matching scrollbar)
    if (cleaningData.length > 0) {
      const halfIndex = Math.floor(cleaningData.length / 2);
      const startDate = cleaningData[0].date;
      const endDate = cleaningData[halfIndex].date;
      xAxis.zoomToDates(new Date(startDate), new Date(endDate));
    }

    // Y-axis for Efficiency - dynamic range based on data
    const maxEfficiency = cleaningData.length > 0 
      ? Math.max(...cleaningData.map(d => d.efficiency), 0) 
      : 100;
    const efficiencyMax = maxEfficiency > 0 ? Math.ceil(maxEfficiency * 1.2) : 100;

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {
          stroke: am5.color('#3b82f6'),
          strokeWidth: 2,
        }),
        min: 0,
        max: efficiencyMax,
      })
    );

    yAxis.get('renderer').labels.template.setAll({
      fill: am5.color('#2563eb'),
      fontSize: 9,
      fontWeight: '600',
    });

    yAxis.get('renderer').grid.template.setAll({
      stroke: am5.color('#e2e8f0'),
      strokeDasharray: [4, 4],
      strokeOpacity: 0.8,
      strokeWidth: 1,
    });

    // Add label for Efficiency axis
    const efficiencyLabel = yAxis.children.unshift(
      am5.Label.new(root, {
        rotation: -90,
        text: 'Efficiency (%)',
        y: am5.percent(50),
        centerX: am5.percent(50),
        fill: am5.color('#2563eb'),
        fontSize: 9,
        fontWeight: '600',
      })
    );

    // Efficiency series (blue line)
    const efficiencySeries = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: 'Efficiency',
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: 'efficiency',
        valueXField: 'date',
        stroke: am5.color('#2563eb'),
        fill: am5.color('#3b82f6'),
        tooltip: am5.Tooltip.new(root, {
          labelText: '[bold fontSize:10px]{dateLabel}[/]\n[fontSize:10px]Efficiency: [bold fontSize:10px]{valueY.formatNumber("#.0")}%[/]\n[fontSize:10px]Generation: [bold fontSize:10px]{generation.formatNumber("#.0")} KWh[/]',
          pointerOrientation: 'horizontal',
        }),
      })
    );

    // Update tooltip to access generation from data context
    efficiencySeries.get('tooltip')?.label.adapters.add('text', (text, target) => {
      const dataItem = target.dataItem;
      if (dataItem && dataItem.dataContext) {
        const context = dataItem.dataContext as any;
        const generation = context.generation || 0;
        const dateLabel = context.dateLabel || '';
        const efficiency = context.efficiency || 0;
        return `[bold fontSize:10px]${dateLabel}[/]\n[fontSize:10px]Efficiency: [bold fontSize:10px]${efficiency.toFixed(1)}%[/]\n[fontSize:10px]Generation: [bold fontSize:10px]${generation.toFixed(2)} KWh[/]`;
      }
      return text;
    });

    // Configure tooltip styling
    const effTooltip = efficiencySeries.get('tooltip');
    if (effTooltip) {
      effTooltip.get('background')?.setAll({
        fill: am5.color('#ffffff'),
        fillOpacity: 1,
        stroke: am5.color('#2563eb'),
        strokeWidth: 2,
        strokeOpacity: 1,
        shadowColor: am5.color('#000000'),
        shadowBlur: 12,
        shadowOffsetX: 0,
        shadowOffsetY: 3,
      });
      effTooltip.label.setAll({
        fill: am5.color('#1e293b'),
        fontSize: 10,
        fontWeight: '500',
        paddingTop: 8,
        paddingBottom: 8,
        paddingLeft: 10,
        paddingRight: 10,
      });
    }

    efficiencySeries.strokes.template.setAll({
      strokeWidth: 2,
      shadowColor: am5.color('#2563eb'),
      shadowBlur: 4,
      shadowOffsetX: 0,
      shadowOffsetY: 1,
      strokeOpacity: 1,
    });

    efficiencySeries.fills.template.setAll({
      fillOpacity: 0,
      visible: false,
    });

    // Add bullets (dots) for efficiency series - same as Generation & Efficiency Trend
    efficiencySeries.bullets.push(() => {
      return am5.Bullet.new(root, {
        sprite: am5.Circle.new(root, {
          radius: 5,
          fill: am5.color('#2563eb'),
          stroke: am5.color('#ffffff'),
          strokeWidth: 2,
          shadowColor: am5.color('#2563eb'),
          shadowBlur: 4,
          shadowOffsetX: 0,
          shadowOffsetY: 1,
        }),
      });
    });

    // Add yellow dotted vertical lines for cleaning dates from API that fall within chart date range
    console.log('Rendering chart - cleaningRecords:', cleaningRecords.length, 'cleaningData:', cleaningData.length);
    
    if (cleaningRecords.length > 0 && cleaningData.length > 0) {
      // Get the date range from the chart data (with some padding to include edge dates)
      const chartDates = cleaningData.map(item => item.date);
      const minChartDate = Math.min(...chartDates);
      const maxChartDate = Math.max(...chartDates);
      
      // Add 1 day padding on each side to ensure edge dates are included
      const minDateWithPadding = minChartDate - (24 * 60 * 60 * 1000); // Subtract 1 day
      const maxDateWithPadding = maxChartDate + (24 * 60 * 60 * 1000); // Add 1 day
      
      console.log('Chart date range:', new Date(minChartDate).toISOString(), 'to', new Date(maxChartDate).toISOString());
      
      cleaningRecords.forEach((record, index) => {
        // Use cleaning_date as primary (this is the actual cleaning date)
        // Fallback to other fields if cleaning_date is not available
        const dateToUse = record.cleaning_date || record.last_cleaning_date || record.date || record.cleaned_date;
        
        console.log(`Processing record ${index}:`, record, 'dateToUse:', dateToUse);
        
        if (dateToUse) {
          try {
            // Parse cleaning date using the EXACT same method as chart data
            // Chart data uses: new Date(dateStr + 'T00:00:00').getTime()
            const dateStr = dateToUse;
            
            // Parse date string (YYYY-MM-DD) to UTC date components
            const dateParts = dateStr.split('-');
            if (dateParts.length !== 3) {
              console.warn('Invalid date format:', dateToUse);
              return;
            }
            
            const year = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
            const day = parseInt(dateParts[2], 10);
            
            // Create date at midnight UTC to match chart data parsing exactly
            // Chart data uses: new Date(dateStr + 'T00:00:00')
            // This creates a date in local timezone, but we need to match it exactly
            const cleaningDateObj = new Date(dateStr + 'T00:00:00');
            const cleaningDate = cleaningDateObj.getTime();
            
            // Check if date is valid
            if (isNaN(cleaningDate)) {
              console.warn('Invalid cleaning date:', dateToUse);
              return;
            }
            
            // Find the exact matching data point in chart data by comparing date strings
            // This is the most reliable way to ensure perfect alignment with X-axis labels
            const matchingDataPoint = cleaningData.find(item => {
              // If dateStr is stored, use it for exact match
              if (item.dateStr) {
                return item.dateStr === dateStr;
              }
              // Fallback: compare by date components
              const itemDate = new Date(item.date);
              const itemYear = itemDate.getFullYear();
              const itemMonth = itemDate.getMonth();
              const itemDay = itemDate.getDate();
              return itemYear === year && itemMonth === month && itemDay === day;
            });
            
            // CRITICAL: The DateAxis positions labels at the start of each day interval (midnight)
            // Even if data points have different timestamps, labels appear at midnight
            // We need to use a timestamp that represents exactly midnight of the cleaning date
            // Use the same parsing method as chart data: new Date(dateStr + 'T00:00:00')
            const midnightDate = new Date(dateStr + 'T00:00:00');
            const midnightTimestamp = midnightDate.getTime();
            
            // Verify we have a matching data point (for validation, but use midnight timestamp for alignment)
            if (!matchingDataPoint) {
              console.warn('No matching data point found for cleaning date:', dateStr, 'but showing line at midnight');
            }
            
            // Only show line if cleaning date falls within the chart's date range (with padding)
            if (midnightTimestamp >= minDateWithPadding && midnightTimestamp <= maxDateWithPadding) {
              // Create axis range using midnight timestamp
              // This aligns with how DateAxis positions labels at the start of each day interval
              // The DateAxis with baseInterval: day shows labels at midnight, regardless of data point timestamps
      const rangeDataItem = xAxis.makeDataItem({
                value: midnightTimestamp, // Use midnight timestamp to align with label position
      });

      const range = xAxis.createAxisRange(rangeDataItem);
              const grid = range.get('grid');
              
              if (grid) {
                // Position grid line at the start of the day interval (where DateAxis positions the label)
                // The location property controls where within the interval the line appears
                // Setting to 0 positions it at the start, matching the label position
                grid.setAll({
                  stroke: am5.color('#fbbf24'), // Yellow color
                  strokeDasharray: [5, 5], // Dotted line
                  strokeWidth: 3, // Increased width for better hover detection
                  strokeOpacity: 0.8,
                  interactive: true, // Make it interactive
                  cursorOverStyle: 'pointer', // Show pointer on hover
                  location: 0, // Position at the start of the day interval (where label is)
      });

                // Add label with cleaning date for the line
                const label = rangeDataItem.get('label');
                if (label) {
                  // Format date from YYYY-MM-DD to DD MMM YYYY format (e.g., "15 Jan 2024")
                  let formattedDate = dateStr;
                  try {
                    const dateObj = new Date(dateStr + 'T00:00:00');
                    if (!isNaN(dateObj.getTime())) {
                      formattedDate = dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
                    }
                  } catch (e) {
                    // If formatting fails, use original dateStr
                    formattedDate = dateStr;
                  }
                  
                  label.setAll({
        text: formattedDate,
                    fill: am5.color('#fbbf24'),
                    fontSize: 9,
        fontWeight: '600',
        inside: false,
        centerY: am5.p100,
        dy: -8,
                  });
                  
                  // Add background to label
                  const labelBg = am5.Rectangle.new(root, {
          fill: am5.color('#ffffff'),
                    fillOpacity: 0.95,
                    stroke: am5.color('#fbbf24'),
          strokeWidth: 1.5,
                  });
                  label.set('background', labelBg);
                  label.set('paddingTop', 4);
                  label.set('paddingBottom', 4);
                  label.set('paddingLeft', 8);
                  label.set('paddingRight', 8);
                }
                
                // Add tooltip with cleaning information to the grid line
                const tooltip = am5.Tooltip.new(root, {
                  getFillFromSprite: false,
                  autoTextColor: false,
                  forceHidden: false, // Always show when hovering
                });
                
                tooltip.label.setAll({
                  fill: am5.color('#1e293b'),
                  fontSize: 10,
                  fontWeight: '500',
                });
                
                // Set tooltip content with cleaning record information
                const location = record.location || 'N/A';
                const cleaningType = record.cleaning_type || 'N/A';
                const zone = record.zone || 'N/A';
                const cleaningDate = record.cleaning_date || 'N/A';
                const lastCleaningDate = record.last_cleaning_date || 'N/A';
                const sapId = record.sap_id || 'N/A';
                const bu = record.bu || 'N/A';
                const frequency = record.frequency ? `${record.frequency} days` : 'N/A';
                const panelStatus = record.panel_status || 'N/A';
                
                tooltip.label.adapters.add('text', () => {
                  let tooltipText = `[bold fontSize:10px]Cleaning Details[/]\n[fontSize:10px]BU: ${bu}\nSAP ID: ${sapId}\nLocation: ${location}\nZone: ${zone}\nCleaning Type: ${cleaningType}\nCleaning Date: ${cleaningDate}`;
                  
                  // Add last cleaning date only if it exists and is different from cleaning date
                  if (lastCleaningDate !== 'N/A' && lastCleaningDate && lastCleaningDate !== cleaningDate) {
                    tooltipText += `\nLast Cleaning Date: ${lastCleaningDate}`;
                  }
                  
                  tooltipText += `\nFrequency: ${frequency}\nStatus: ${panelStatus}[/]`;
                  
                  return tooltipText;
                });
                
                tooltip.get('background')?.setAll({
                  fill: am5.color('#ffffff'),
                  fillOpacity: 1,
                  stroke: am5.color('#fbbf24'),
                  strokeWidth: 2,
                  strokeOpacity: 1,
                  shadowColor: am5.color('#000000'),
                  shadowBlur: 8,
                  shadowOffsetX: 0,
                  shadowOffsetY: 2,
                });
                
                tooltip.set('paddingTop', 8);
                tooltip.set('paddingBottom', 8);
                tooltip.set('paddingLeft', 10);
                tooltip.set('paddingRight', 10);
                
                // Attach tooltip to the grid line
                grid.set('tooltip', tooltip);
                
                // Add hover effect to make it more visible
                grid.states.create('hover', {
                  strokeWidth: 4,
                  strokeOpacity: 1,
                });
              }
              
              console.log('Added cleaning line for date:', dateToUse, 'at midnight timestamp:', midnightTimestamp, 'matching data point:', matchingDataPoint ? matchingDataPoint.dateStr || 'found' : 'not found');
            } else {
              console.log('Cleaning date outside range:', dateToUse, 'Chart range:', new Date(minChartDate).toISOString(), 'to', new Date(maxChartDate).toISOString());
            }
          } catch (error) {
            console.error('Error parsing cleaning date:', dateToUse, error);
          }
        }
      });
    }

    // Add cursor for better tooltip interaction
    const cursor = chart.set('cursor', am5xy.XYCursor.new(root, {
      xAxis: xAxis,
      behavior: 'zoomX',
    }));

    cursor.lineX.setAll({
      stroke: am5.color('#2563eb'),
      strokeOpacity: 0.5,
      strokeDasharray: [4, 4],
      strokeWidth: 1.5,
    });

    cursor.lineY.setAll({
      visible: false,
    });

    // Add data
    efficiencySeries.data.setAll(cleaningData);

    // Make stuff animate on load
    chart.appear(1000, 100);

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
    };
  }, [cleaningData, cleaningType, isLoading, plant, appliedPlant, cleaningRecords]);

  const handleSubmitCleaningRecord = async () => {
    try {
      let locationValue = selectedLocation ? String(selectedLocation) : '';
      if (formPlant && plantOptions.length > 0) {
        const foundPlant = plantOptions.find((p) => p.id === formPlant);
        if (foundPlant) {
          locationValue = foundPlant.name;
        }
      }
      // Use header bu (source of truth) for create and get_panel_status
      const buRaw = bu || formBU || '';
      const buForApi = buRaw === 'TAS' ? 'SOD' : buRaw;
      const payload = {
        bu: buForApi,
        sap_id: formPlant || '',
        location: locationValue,
        zone: formZone || '',
        cleaning_type: cleaningType,
        cleaning_date: formDate || '',
      };
      const response = await apiClient.post('/api/solarpanelwetdrycleaning/create_solar_panel_cleaning_record', payload);
      if (response?.data) {
        setAppliedZone(formZone || null);
        setAppliedPlant(formPlant || null);
        // 1. First call get_panel_status, then refresh the rest of the card
        try {
          await apiClient.post('/api/solarpanelwetdrycleaning/get_panel_status', {
            bu: buForApi,
            sap_id: formPlant || '',
            location: locationValue,
            zone: formZone || '',
            cleaning_type: cleaningType || '',
          });
        } catch (err) {
          console.error('Error fetching panel status after submit:', err);
        }
        setCardRefreshKey((k) => k + 1);
        setIsDatePickerOpen(false);
      }
    } catch (error) {
      console.error('Error creating cleaning record:', error);
      setAppliedZone(formZone || null);
      setAppliedPlant(formPlant || null);
      setIsDatePickerOpen(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-end mb-1">
        <div className="flex flex-col sm:flex-row items-center gap-2">
          {/* Pending/Completed Counts */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPendingPopup(true)}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-orange-100 text-orange-700 hover:bg-orange-200 border border-orange-300 transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5" />
              Pending: {pendingCount}
            </button>
            <button
              onClick={() => setShowCompletedPopup(true)}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-green-100 text-green-700 hover:bg-green-200 border border-green-300 transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Completed: {completedCount}
            </button>
          </div>
          
          {/* Cleaning Type Toggle */}
          <div className="flex items-center bg-gray-100 rounded-md p-0.5 border border-gray-200 shadow-sm">
            <button
              onClick={() => setCleaningType('dry')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
                cleaningType === 'dry'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-gray-200'
              }`}
            >
              Dry Clean
            </button>
            <button
              onClick={() => setCleaningType('wet')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
                cleaningType === 'wet'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-gray-200'
              }`}
            >
              Wet Clean
            </button>
          </div>

          {/* Date Picker */}
          <div>
            <button
              onClick={() => {
                // Initialize form values when opening
                if (!isDatePickerOpen) {
                  setFormBU(bu || 'SOD'); // Use current BU from header (e.g. LPG)
                  setFormZone(zone ? (Array.isArray(zone) ? zone[0] || '' : zone) : '');
                  setFormPlant(plant || '');
                  setFormDate('');
                }
                setIsDatePickerOpen(!isDatePickerOpen);
              }}
              className="p-1.5 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all shadow-sm hover:shadow-md"
              title="Open filter"
            >
              <FileCog className="w-4 h-4" />
            </button>

            {isDatePickerOpen && (
              <>
                {/* Overlay */}
                <div 
                  className="fixed inset-0 bg-black bg-opacity-50 z-50"
                  onClick={() => setIsDatePickerOpen(false)}
                ></div>
                {/* Centered Modal */}
                <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
                  <div 
                    className="bg-white border border-gray-300 rounded-lg shadow-2xl p-6 min-w-[400px] max-w-[450px] pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                <div className="space-y-4">
                      {/* BU Selection */}
                  <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 block">
                          BU
                        </label>
                        <select
                          value={formBU}
                          onChange={(e) => {
                            setFormBU(e.target.value);
                            setFormPlant(''); // Reset plant when BU changes
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-gray-700 bg-white text-sm shadow-sm"
                        >
                          {buOptions.map((buOption) => (
                            <option key={buOption} value={buOption}>
                              {buOption}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Zone Selection */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 block">
                          Zone
                        </label>
                        <select
                          value={formZone}
                          onChange={(e) => {
                            setFormZone(e.target.value);
                            setFormPlant(''); // Reset plant when zone changes
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-gray-700 bg-white text-sm shadow-sm"
                        >
                          <option value="">Select Zone</option>
                          {zoneOptions.map((zoneOption) => (
                            <option key={zoneOption} value={zoneOption}>
                              {zoneOption}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Plant Selection */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 block">
                          Plant
                        </label>
                        <select
                          value={formPlant}
                          onChange={(e) => setFormPlant(e.target.value)}
                          disabled={!formZone || isLoadingPlants}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-gray-700 bg-white text-sm shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          <option value="">Select Plant</option>
                          {plantOptions.map((plantOption) => (
                            <option key={plantOption.id} value={plantOption.id}>
                              {plantOption.name}
                            </option>
                          ))}
                        </select>
                        {isLoadingPlants && (
                          <p className="text-xs text-gray-500">Loading plants...</p>
                        )}
                      </div>

                      {/* Date Selection */}
                  <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 block">
                          From Date
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                            value={formDate}
                            onChange={(e) => setFormDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-gray-700 bg-white text-sm shadow-sm"
                        style={{
                              color: formDate ? '#374151' : 'transparent'
                        }}
                        onFocus={(e) => {
                          e.target.style.color = '#374151';
                        }}
                        onBlur={(e) => {
                              if (!formDate) {
                            e.target.style.color = 'transparent';
                          }
                        }}
                      />
                          {!formDate && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-sm">
                          dd/mm/yyyy
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setIsDatePickerOpen(false);
                        // Reset to original values (use current BU from header)
                        setFormBU(bu || 'SOD');
                        setFormZone(zone ? (Array.isArray(zone) ? zone[0] || '' : zone) : '');
                        setFormPlant(plant || '');
                        setFormDate('');
                      }}
                      className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 hover:border-gray-400 rounded text-sm font-medium transition-all shadow-sm hover:shadow-md"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitCleaningRecord}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white border border-purple-600 hover:border-purple-700 rounded text-sm font-medium transition-all shadow-md hover:shadow-lg"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {isLoading ? (
        <div className="w-full flex items-center justify-center" style={{ height: '320px' }}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading chart data...</p>
      </div>
        </div>
      ) : cleaningData.length === 0 ? (
        <div className="w-full flex items-center justify-center" style={{ height: '320px' }}>
          <div className="text-gray-500 text-sm">No data available</div>
      </div>
      ) : (
        <div ref={chartRef} className="w-full" style={{ height: '320px', minHeight: '320px' }}></div>
      )}
      
      {showPendingPopup && (
        <>
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={() => setShowPendingPopup(false)}
          ></div>
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div 
              className="bg-white border border-gray-300 rounded-lg shadow-2xl p-6 min-w-[800px] max-w-[1000px] max-h-[80vh] overflow-auto pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-lg font-semibold text-gray-900 shrink-0">Pending Cleaning Details</h3>
                <input
                  type="text"
                  placeholder="Search..."
                  value={pendingSearchTerm}
                  onChange={(e) => setPendingSearchTerm(e.target.value)}
                  className="flex-1 max-w-[220px] px-3 py-1 border border-gray-300 rounded text-gray-700 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                />
                <button
                  onClick={() => {
                    setShowPendingPopup(false);
                    setPendingSearchTerm('');
                  }}
                  className="text-gray-500 hover:text-gray-700 text-xl font-bold shrink-0"
                >
                  ×
                </button>
              </div>
              <div className="border border-gray-200 overflow-hidden bg-white rounded-md cleaning-details-visible-scroll">
                <style>{`
                  .cleaning-details-visible-scroll .ag-body-viewport,
                  .cleaning-details-visible-scroll .ag-center-cols-viewport,
                  .cleaning-details-visible-scroll .ag-body-horizontal-scroll-viewport {
                    -ms-overflow-style: auto !important;
                    scrollbar-width: thin !important;
                    scrollbar-color: #94a3b8 #e2e8f0 !important;
                  }
                  .cleaning-details-visible-scroll .ag-body-viewport::-webkit-scrollbar,
                  .cleaning-details-visible-scroll .ag-center-cols-viewport::-webkit-scrollbar,
                  .cleaning-details-visible-scroll .ag-body-horizontal-scroll-viewport::-webkit-scrollbar {
                    display: block !important;
                    width: 10px;
                    height: 10px;
                  }
                  .cleaning-details-visible-scroll .ag-body-viewport::-webkit-scrollbar-thumb,
                  .cleaning-details-visible-scroll .ag-center-cols-viewport::-webkit-scrollbar-thumb,
                  .cleaning-details-visible-scroll .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb {
                    background: #94a3b8;
                    border-radius: 5px;
                  }
                  .cleaning-details-visible-scroll .ag-body-viewport::-webkit-scrollbar-track,
                  .cleaning-details-visible-scroll .ag-center-cols-viewport::-webkit-scrollbar-track,
                  .cleaning-details-visible-scroll .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-track {
                    background: #f1f5f9;
                  }
                `}</style>
                <div className="[&_.ag-header-cell]:!bg-gray-100 [&_.ag-header-cell-text]:!text-gray-700 [&_.ag-header-cell-text]:!font-semibold [&_.ag-header-cell-text]:!text-sm [&_.ag-header-cell]:!py-2 [&_.ag-header-cell]:!px-3 [&_.ag-header-cell]:!min-h-0 [&_.ag-cell]:!text-gray-800 [&_.ag-cell]:!text-xs [&_.ag-cell]:!font-normal [&_.ag-cell]:!py-1 [&_.ag-row]:!min-h-0" style={{ minHeight: `${TABLE_HEADER_HEIGHT + TABLE_MIN_VISIBLE_ROWS * TABLE_ROW_HEIGHT}px` }}>
                  <DataGrid
                    rowData={pendingDetails.map((item: any) => ({
                      ...item,
                      bu: item.bu ?? 'N/A',
                      sap_id: item.sap_id ?? 'N/A',
                      location: item.location ?? 'N/A',
                      zone: item.zone ?? 'N/A',
                      cleaning_type: item.cleaning_type ?? 'N/A',
                      frequency: item.frequency ?? 'N/A',
                      last_cleaning_date: item.last_cleaning_date ?? 'N/A',
                      panel_status: item.panel_status ?? 'N/A',
                    }))}
                    columnDefs={pendingDetailsColumnDefs}
                    defaultColDef={cleaningDetailsDefaultColDef}
                    quickFilterText={pendingSearchTerm}
                    height={`${pendingTableHeight}px`}
                    pagination={true}
                    paginationPageSize={10}
                    rowSelection="single"
                    suppressRowClickSelection={true}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Completed Details Popup */}
      {showCompletedPopup && (
        <>
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={() => setShowCompletedPopup(false)}
          ></div>
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div 
              className="bg-white border border-gray-300 rounded-lg shadow-2xl p-6 min-w-[800px] max-w-[1000px] max-h-[80vh] overflow-auto pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-lg font-semibold text-gray-900 shrink-0">Completed Cleaning Details</h3>
                <input
                  type="text"
                  placeholder="Search..."
                  value={completedSearchTerm}
                  onChange={(e) => setCompletedSearchTerm(e.target.value)}
                  className="flex-1 max-w-[220px] px-3 py-1 border border-gray-300 rounded text-gray-700 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                />
                <button
                  onClick={() => {
                    setShowCompletedPopup(false);
                    setCompletedSearchTerm('');
                  }}
                  className="text-gray-500 hover:text-gray-700 text-xl font-bold shrink-0"
                >
                  ×
                </button>
              </div>
              <div className="border border-gray-200 overflow-hidden bg-white rounded-md cleaning-details-visible-scroll">
                <style>{`
                  .cleaning-details-visible-scroll .ag-body-viewport,
                  .cleaning-details-visible-scroll .ag-center-cols-viewport,
                  .cleaning-details-visible-scroll .ag-body-horizontal-scroll-viewport {
                    -ms-overflow-style: auto !important;
                    scrollbar-width: thin !important;
                    scrollbar-color: #94a3b8 #e2e8f0 !important;
                  }
                  .cleaning-details-visible-scroll .ag-body-viewport::-webkit-scrollbar,
                  .cleaning-details-visible-scroll .ag-center-cols-viewport::-webkit-scrollbar,
                  .cleaning-details-visible-scroll .ag-body-horizontal-scroll-viewport::-webkit-scrollbar {
                    display: block !important;
                    width: 10px;
                    height: 10px;
                  }
                  .cleaning-details-visible-scroll .ag-body-viewport::-webkit-scrollbar-thumb,
                  .cleaning-details-visible-scroll .ag-center-cols-viewport::-webkit-scrollbar-thumb,
                  .cleaning-details-visible-scroll .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb {
                    background: #94a3b8;
                    border-radius: 5px;
                  }
                  .cleaning-details-visible-scroll .ag-body-viewport::-webkit-scrollbar-track,
                  .cleaning-details-visible-scroll .ag-center-cols-viewport::-webkit-scrollbar-track,
                  .cleaning-details-visible-scroll .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-track {
                    background: #f1f5f9;
                  }
                `}</style>
                <div className="[&_.ag-header-cell]:!bg-gray-100 [&_.ag-header-cell-text]:!text-gray-700 [&_.ag-header-cell-text]:!font-semibold [&_.ag-header-cell-text]:!text-sm [&_.ag-header-cell]:!py-2 [&_.ag-header-cell]:!px-3 [&_.ag-header-cell]:!min-h-0 [&_.ag-cell]:!text-gray-800 [&_.ag-cell]:!text-xs [&_.ag-cell]:!font-normal [&_.ag-cell]:!py-1 [&_.ag-row]:!min-h-0" style={{ minHeight: `${TABLE_HEADER_HEIGHT + TABLE_MIN_VISIBLE_ROWS * TABLE_ROW_HEIGHT}px` }}>
                  <DataGrid
                    rowData={completedDetails.map((item: any) => ({
                      ...item,
                      bu: item.bu ?? 'N/A',
                      sap_id: item.sap_id ?? 'N/A',
                      location: item.location ?? 'N/A',
                      zone: item.zone ?? 'N/A',
                      cleaning_type: item.cleaning_type ?? 'N/A',
                      frequency: item.frequency ?? 'N/A',
                      cleaning_date: item.cleaning_date ?? 'N/A',
                      last_cleaning_date: item.last_cleaning_date ?? 'N/A',
                      panel_status: item.panel_status ?? 'N/A',
                    }))}
                    columnDefs={completedDetailsColumnDefs}
                    defaultColDef={cleaningDetailsDefaultColDef}
                    quickFilterText={completedSearchTerm}
                    height={`${completedTableHeight}px`}
                    pagination={true}
                    paginationPageSize={10}
                    rowSelection="single"
                    suppressRowClickSelection={true}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PanelCleaningImpact;