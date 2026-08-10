import React, { useLayoutEffect, useEffect, useState, useRef, useCallback, useMemo, type JSX } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5percent from '@amcharts/amcharts5/percent';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import * as am5map from '@amcharts/amcharts5/map';
import am5geodata_india2019High from '@amcharts/amcharts5-geodata/india2019High';
// Mappls will be loaded dynamically
import { toast } from 'sonner';
import { MapPin, Building2, Users, MapIcon, Navigation, Landmark, Filter, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from "@/@/components/ui/tabs";
import LocationDialog from './dilogue/LocationDialog';
import UploadDialog, { type UploadStatus } from './dilogue/UploadDialog';
import PieChartSection from './chart/PieChartSection';
import CompanyCountSidebar from './sidebar/CompanyCountSidebar';
import FilterSidebar from './sidebar/FilterSidebar';
import type { Location } from './types/location';
import UpdateDataTable from './table_/Updatetable';
import FilteredTable from './table_/FilteredTable';
import DateRangePickerComponent from './table_/datepicker';
import { apiClient } from '@/services/apiClient';
import FilterImage from './image/Filterimage';
import lubesImage from '../IndiaMap/src/assets/oil.svg'
import aviationImage from '../IndiaMap/src/assets/plane.svg'
import LpgRepo from '../IndiaMap/src/assets/tank.svg'
import WaterDrop from '../IndiaMap/src/assets/waterr.svg'

// Declare Google Maps types
declare global {
  interface Window {
    google: any;
  }
}

type SortDirection = 'asc' | 'desc' | null;
interface SortConfig { key: string; direction: SortDirection; }
interface UpdateTableRow { [key: string]: any; }
interface BoundsCache {
  [key: string]: { north: number; south: number; east: number; west: number; };
}

// Define GeoJSON interface for proper typing
interface PatchDataGeoJSON {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: {
      type: "Polygon";
      coordinates: number[][][];
    };
    properties?: { [key: string]: any };
  }>;
}

// Constants
const COUNT_TYPES: Array<'sbu' | 'company' | 'zone' | 'state' | 'district' | 'location_name'> =
  ['sbu', 'company', 'zone', 'state', 'district', 'location_name'];

const ICON_MAP: Record<string, JSX.Element> = {
  sbu: <Users className="w-4 h-4" />,
  company: <Building2 className="w-4 h-4" />,
  zone: <MapIcon className="w-4 h-4" />,
  state: <Navigation className="w-4 h-4" />,
  district: <Landmark className="w-4 h-4" />,
  location_name: <MapPin className="w-4 h-4" />
};

const VALID_SBUS = ['sod', 'lpg', 'lubes', 'aviation'];

// SBU Image Mapping
const SBU_IMAGES = [
  { src: WaterDrop, alt: 'SOD', sbu: 'sod' },
  { src: LpgRepo, alt: 'LPG', sbu: 'lpg' },
  { src: lubesImage, alt: 'Lubes', sbu: 'lubes' },
  { src: aviationImage, alt: 'Aviation', sbu: 'aviation' },
];

// Google Maps API Key and Map ID (map ID required for Advanced Markers)
const GOOGLE_MAPS_API_KEY = 'AIzaSyDfMVbeSC78K1l78ZCsccs0WENDG6brfVc';
const GOOGLE_MAP_ID = (import.meta as any)?.env?.VITE_GOOGLE_MAP_ID || '';
// Use loading=async to follow Google’s recommended loading pattern
const GOOGLE_MAPS_API_URL = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&v=weekly&region=IN&libraries=drawing,geometry,marker&loading=async`;

// Zoom Control Component
interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  currentZoom: number;
}

const ZoomControls: React.FC<ZoomControlsProps> = ({ onZoomIn, onZoomOut, onResetView, currentZoom }) => {
  return (
    <div className="absolute bottom-20 right-4 z-30 flex flex-col gap-1 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 p-1">
      <button
        onClick={onZoomIn}
        className="w-8 h-8 flex items-center justify-center hover:bg-blue-100 rounded text-gray-700 hover:text-blue-600 transition-colors"
        title="Zoom In"
      >
        <span className="text-lg font-bold">+</span>
      </button>

      <div className="w-8 h-6 flex items-center justify-center text-xs text-gray-600 font-mono">
        {Math.round(currentZoom)}
      </div>

      <button
        onClick={onZoomOut}
        className="w-8 h-8 flex items-center justify-center hover:bg-blue-100 rounded text-gray-700 hover:text-blue-600 transition-colors"
        title="Zoom Out"
      >
        <span className="text-lg font-bold">-</span>
      </button>

      <div className="border-t border-gray-300 my-1"></div>

      <button
        onClick={onResetView}
        className="w-8 h-8 flex items-center justify-center hover:bg-green-100 rounded text-gray-700 hover:text-green-600 transition-colors"
        title="Reset to India View"
      >
        <Navigation className="w-4 h-4" />
      </button>
    </div>
  );
};

// Static Images Component with Click Functionality
interface StaticImagesProps {
  onSBUClick: (sbu: string) => void;
  activeSBU: string;
}

const StaticImages: React.FC<StaticImagesProps> = ({ onSBUClick, activeSBU }) => {
  const handleImageClick = (sbu: string, event: React.MouseEvent) => {
    // Prevent event from bubbling up to parent elements
    event.preventDefault();
    event.stopPropagation();

    // Call the SBU click handler
    onSBUClick(sbu);
  };

  return (
    <div className="absolute top-20 left-1 w-20 z-30 space-y-4">
      {SBU_IMAGES.map((img, index) => {
        // Create a variable for the icon component
        const IconComponent = img.src as unknown as React.ComponentType<any>;

        return (
          <div
            key={index}
            className={`cursor-pointer transition-all duration-200 hover:scale-105 ${activeSBU === img.sbu
                ? 'ring-2 ring-blue-400 shadow-lg shadow-blue-400/50 rounded-lg'
                : 'hover:ring-1 hover:ring-white/30 rounded-lg'
              }`}
            onClick={(event) => handleImageClick(img.sbu, event)}
            onMouseDown={(event) => event.stopPropagation()}
            title={`Filter by ${img.alt}`}
            style={{ pointerEvents: 'auto' }}
          >
            {typeof img.src === 'string' ? (
              <FilterImage src={img.src} alt={img.alt} />
            ) : (
              <IconComponent className="w-full h-auto" titleAccess={img.alt} />
            )}
          </div>
        );
      })}
    </div>
  );
};

const IndiaMap: React.FC = () => {
  // State declarations
  const [locations, setLocations] = useState<Location[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [hoveredLocation, setHoveredLocation] = useState<Location | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Track mouse position globally for tooltip
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (showTooltip && hoveredLocation) {
        setTooltipPosition({ x: e.pageX + 10, y: e.pageY + 10 });
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [showTooltip, hoveredLocation]);
  const [filters, setFilters] = useState<Record<string, string[]>>({});

  // NEW: Separate state for ALL filter options (never gets filtered)
  const [allFilterOptions, setAllFilterOptions] = useState<Record<string, string[]>>({});

  const [selectedFilters, setSelectedFilters] = useState<Record<string, string | string[]>>({
    sbu: '', company: [], zone: [], state: [], district: [], location_name: [],
  });

  // Count states
  const [companyCounts, setCompanyCounts] = useState<Record<string, number>>({});
  const [zoneCounts, setZoneCounts] = useState<Record<string, number>>({});
  const [stateCounts, setStateCounts] = useState<Record<string, number>>({});
  const [districtCounts, setDistrictCounts] = useState<Record<string, number>>({});
  const [locationCounts, setLocationCounts] = useState<Record<string, number>>({});

  // UI states
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [pieChartLevel, setPieChartLevel] = useState<'company' | 'zone' | 'state' | 'district' | 'location_name'>('company');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [colorMapping, setColorMapping] = useState<Record<string, string>>({});
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: '', direction: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [displayData, setDisplayData] = useState<any[]>([]);
  const [showFilteredTable, setShowFilteredTable] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [lastFetchedFilters, setLastFetchedFilters] = useState<string>('');
  const [activeSBUFilter, setActiveSBUFilter] = useState<string>('');

  // Map states
  const [showStateOutlines, setShowStateOutlines] = useState(true);
  const [mapStyle, setMapStyle] = useState<'satellite' | 'vector'>('satellite');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [statesData, setStatesData] = useState<any>(null);
  const [indiaBorderData, setIndiaBorderData] = useState<any>(null);

  // Upload states
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    isUploading: false, success: false, error: null, fileName: null,
  });

  // Update states
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateTableData, setUpdateTableData] = useState<UpdateTableRow[]>([]);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [isLoadingUpdate, setIsLoadingUpdate] = useState(false);
  const [updateSearchTerm, setUpdateSearchTerm] = useState('');
  const [editedRow, setEditedRow] = useState<UpdateTableRow>({});

  // Date states
  const [selectedFromDate, setSelectedFromDate] = useState('');
  const [selectedToDate, setSelectedToDate] = useState('');

  // Unused states (keeping for compatibility)
  const [, setShowStateDialog] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stateMapRef = useRef<HTMLDivElement | null>(null);
  const pieChartRef = useRef<HTMLDivElement | null>(null);
  const pieChartRoot = useRef<am5.Root | null>(null);
  
  // Mappls refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const overlaysRef = useRef<any[]>([]);
  
  const boundsCache = useRef<BoundsCache>({});
  const lastHighlightedFilter = useRef<string>('');
  const pieChartSeries = useRef<any>(null);
  const hasInitialData = useRef<boolean>(false);
  const scriptLoadedRef = useRef<boolean>(false);
const mapInitRetryRef = useRef<number>(0);

  // Load Google Maps API script dynamically
  useEffect(() => {
    // Check if script is already loaded
    if (window.google && window.google.maps) {
      setMapLoaded(true);
      return;
    }

    // Check if script is already being loaded
    if (scriptLoadedRef.current) {
      return;
    }

    // Check if script tag already exists (ignore loading param differences)
    const existingScript = Array.from(document.querySelectorAll('script')).find((s) =>
      (s as HTMLScriptElement).src?.startsWith(`https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`)
    );
    if (existingScript) {
      // Script exists, wait for it to load
      existingScript.addEventListener('load', () => {
        setMapLoaded(true);
      });
      return;
    }

    // Create and load script
    scriptLoadedRef.current = true;
    const script = document.createElement('script');
    script.src = GOOGLE_MAPS_API_URL;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      setMapLoaded(true);
    };
    
    script.onerror = () => {
      console.error('Failed to load Google Maps API');
      scriptLoadedRef.current = false;
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup: don't remove script on unmount as it might be used elsewhere
      scriptLoadedRef.current = false;
    };
  }, []);

  // Zoom control functions
  const handleZoomIn = useCallback(() => {
    const map = mapInstanceRef.current;
    if (map && map.setZoom && map.getZoom) {
      const currentZoom = map.getZoom();
      map.setZoom(currentZoom + 1);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    const map = mapInstanceRef.current;
    if (map && map.setZoom && map.getZoom) {
      const currentZoom = map.getZoom();
      map.setZoom(currentZoom - 1);
    }
  }, []);

  const handleResetView = useCallback(() => {
    const map = mapInstanceRef.current;
    if (map && map.setCenter && map.setZoom) {
      // Reset to perfect India center view
      map.panTo({ lat: 21.5, lng: 79.0 });
      map.setZoom(4.9);
      console.log('🗺️ Reset to India center view');
    }
  }, []);

  // Toggle map type between Satellite and Roadmap
  const toggleMapType = useCallback(() => {
    setMapStyle((prev) => {
      const newType = prev === 'satellite' ? 'vector' : 'satellite';
      console.log(`🔄 Toggling map type from ${prev} to ${newType}`);
      return newType;
    });
  }, []);

  // Auto-adjust based on screen size
  const getResponsiveZoom = useCallback(() => {
    const screenWidth = window.innerWidth;
    if (screenWidth < 768) return 4.5; // Mobile
    if (screenWidth < 1024) return 4.7; // Tablet
    if (screenWidth < 1440) return 4.9; // Small desktop
    return 4.9; // Large desktop - Complete India view with full north
  }, []);

  const getResponsivePadding = useCallback(() => {
    const screenWidth = window.innerWidth;
    if (screenWidth < 768) {
      return { top: 60, bottom: 60, left: 20, right: 20 }; // Mobile
    }
    if (screenWidth < 1024) {
      return { top: 70, bottom: 70, left: 200, right: 50 }; // Tablet
    }
    return { top: 80, bottom: 80, left: 320, right: 80 }; // Desktop
  }, []);

  // Utility functions
  const getSelectedValue = useCallback((filterValue: string | string[]) => {
    if (Array.isArray(filterValue) && filterValue.length > 0) return filterValue[0];
    if (typeof filterValue === 'string' && filterValue.trim()) return filterValue;
    return '';
  }, []);

  const isSBUSelected = useCallback(() => {
    const sbuValue = getSelectedValue(selectedFilters.sbu);
    return Boolean(sbuValue);
  }, [selectedFilters.sbu, getSelectedValue]);

  // New function to check if LPG is selected
  const isLPGSelected = useCallback(() => {
    const sbuValue = getSelectedValue(selectedFilters.sbu);
    return sbuValue?.toLowerCase() === 'lpg';
  }, [selectedFilters.sbu, getSelectedValue]);

  // Memoized values
const filtersPayload = useMemo(() => {
  const baseFilters = Object.entries(selectedFilters).reduce<Array<{
    key: string;
    cond: string;
    value: string;
    val: string;
  }>>((acc, [key, val]) => {
    if (Array.isArray(val)) {
      const filteredValues = val.filter(v => v);
      if (filteredValues.length > 0) {
        acc.push({
          key,
          cond: 'in',
          value: filteredValues.join(','),
          val: filteredValues.join(',')
        });
      }
    } else if (val) {
      acc.push({ key, cond: 'in', value: val, val });
    }
    return acc;
  }, []);

  return baseFilters;
}, [selectedFilters]);

// Keep dates only in filtersKey for memoization
const filtersKey = useMemo(() => JSON.stringify({
  ...selectedFilters,
  fromDate: selectedFromDate,
  toDate: selectedToDate
}), [selectedFilters, selectedFromDate, selectedToDate]);

// Search filter for table data
const filteredUpdateData = useMemo(() =>
  updateTableData.filter(row =>
    Object.values(row).some(value =>
      value?.toString().toLowerCase().includes(updateSearchTerm.toLowerCase())
    )
  ), [updateTableData, updateSearchTerm]
);

// Current counts depending on pie chart level
const currentCounts = useMemo(() => {
  const countsMap = {
    company: companyCounts,
    zone: zoneCounts,
    state: stateCounts,
    district: districtCounts,
    location_name: locationCounts
  };
  return countsMap[pieChartLevel] || companyCounts;
}, [pieChartLevel, companyCounts, zoneCounts, stateCounts, districtCounts, locationCounts]);

// Total count
const totalCount = useMemo(() =>
  Object.values(currentCounts).reduce((sum, count) => sum + count, 0),
  [currentCounts]
);

// Date filtering function for locations (client-side only)
const filterLocationsByDate = useCallback((locations: Location[]) => {
  if (!isLPGSelected() || (!selectedFromDate && !selectedToDate)) {
    return locations;
  }

  return locations.filter((location: Location) => {
    // Only HPCL locations
    const isHPCL = location.company?.toLowerCase().includes("hpcl");
    if (!isHPCL) return false;

    // Require commissioning date
    const commissioningDate = location.time_of_commissioning;
    if (!commissioningDate) return false;

    // Parse
    let locationDate: Date | null = null;
    if (typeof commissioningDate === "string") {
      locationDate = new Date(commissioningDate);
    } else if (commissioningDate instanceof Date) {
      locationDate = commissioningDate;
    }

    if (!locationDate || isNaN(locationDate.getTime())) {
      console.warn("Invalid date excluded:", commissioningDate);
      return false;
    }

    // Normalize
    const locationDateOnly = new Date(
      locationDate.getFullYear(),
      locationDate.getMonth(),
      locationDate.getDate()
    );

    if (selectedFromDate && selectedToDate) {
      const fromDate = new Date(selectedFromDate);
      const toDate = new Date(selectedToDate);
      const fromDateOnly = new Date(
        fromDate.getFullYear(),
        fromDate.getMonth(),
        fromDate.getDate()
      );
      const toDateOnly = new Date(
        toDate.getFullYear(),
        toDate.getMonth(),
        toDate.getDate(),
        23, 59, 59, 999
      );
      return locationDateOnly >= fromDateOnly && locationDateOnly <= toDateOnly;
    }

    if (selectedFromDate) {
      const fromDate = new Date(selectedFromDate);
      const fromDateOnly = new Date(
        fromDate.getFullYear(),
        fromDate.getMonth(),
        fromDate.getDate()
      );
      return locationDateOnly >= fromDateOnly;
    }

    if (selectedToDate) {
      const toDate = new Date(selectedToDate);
      const toDateOnly = new Date(
        toDate.getFullYear(),
        toDate.getMonth(),
        toDate.getDate(),
        23, 59, 59, 999
      );
      return locationDateOnly <= toDateOnly;
    }

    return true;
  });
}, [isLPGSelected, selectedFromDate, selectedToDate]);

  // NEW: Function to calculate ALL filter options from ALL locations (never filtered)
  const calculateAllFilterOptions = useCallback((allLocations: Location[]) => {
    const filterOptions: Record<string, string[]> = {};

    allLocations.forEach((item: Location) => {
      COUNT_TYPES.forEach(countType => {
        const fieldValue = item[countType];
        if (fieldValue) {
          if (!filterOptions[countType]) {
            filterOptions[countType] = [];
          }
          if (!filterOptions[countType].includes(fieldValue)) {
            filterOptions[countType].push(fieldValue);
          }
        }
      });
    });

    return filterOptions;
  }, []);

  // UPDATED: Helper function to calculate counts and color mapping from filtered data only
  const calculateCountsAndColorMapping = useCallback((currentFilteredLocations: Location[]) => {
    // Calculate counts from filtered data (what should be displayed in pie chart)
    const counts = COUNT_TYPES.reduce((acc, type) => ({ ...acc, [type]: {} }), {} as Record<string, Record<string, number>>);
    const newColorMapping: Record<string, string> = {};

    currentFilteredLocations.forEach((item: Location) => {
      COUNT_TYPES.forEach(countType => {
        const fieldValue = item[countType];
        if (fieldValue) {
          // Update counts based on filtered data
          counts[countType][fieldValue] = (counts[countType][fieldValue] || 0) + 1;

          // Update color mapping (skip for SBU as it doesn't need color mapping)
          if (countType !== 'sbu' && item.color_code && !newColorMapping[fieldValue]) {
            let colorCode = item.color_code.toString().trim();
            if (!colorCode.startsWith('#')) colorCode = '#' + colorCode;
            if (/^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(colorCode)) {
              newColorMapping[fieldValue] = colorCode;
            }
          }
        }
      });
    });
    
    return { counts, colorMapping: newColorMapping };
  }, []);

  const getApiEndpoints = useCallback((sbu: string) => {
    const sbuLower = sbu.toLowerCase();
    const baseEndpoints = {
      lpg: { getAll: '/api/lpginfra/get_all_lpg_infra', update: '/api/lpginfra/update_lpg_data', delete: '/api/lpginfra/delete_lpg_data', upload: '/api/lpginfra/upload_lpg_file' },
      sod: { getAll: '/api/sodinfra/get_all_sod_infra', update: '/api/sodinfra/update_sod_data', delete: '/api/sodinfra/delete_sod_data', upload: '/api/sodinfra/upload_sod_file' },
      lubes: { getAll: '/api/lubesinfra/get_all_lubes_infra', update: '/api/lubesinfra/update_lubes_data', delete: '/api/lubesinfra/delete_lubes_data', upload: '/api/lubesinfra/upload_lubes_file' },
      aviation: { getAll: '/api/aviationinfra/get_all_aviation_infra', update: '/api/aviationinfra/update_aviation_data', delete: '/api/aviationinfra/delete_aviation_data', upload: '/api/aviationinfra/upload_aviation_file' },
    };
    return baseEndpoints[sbuLower as keyof typeof baseEndpoints] || baseEndpoints.sod;
  }, []);

  const canUpload = useCallback(() => {
    const sbuValue = getSelectedValue(selectedFilters.sbu);
    return VALID_SBUS.includes(sbuValue?.toLowerCase?.() || '');
  }, [selectedFilters.sbu, getSelectedValue]);

  const canUpdate = useCallback(() => canUpload(), [canUpload]);

  // GeoJSON loading disabled for performance (borders removed)
  // const loadGeoJSONData = useCallback(async () => {
  //   console.log("🗺️ Loading India border GeoJSON...");
  //   try {
  //     const response = await fetch(
  //       "https://raw.githubusercontent.com/datameet/maps/master/Country/india-osm.geojson"
  //     );
  //     if (response.ok) {
  //       const data = await response.json();
  //       setIndiaBorderData(data);
  //       console.log("✅ India border data loaded successfully");
  //     } else {
  //       console.error("❌ Failed to load India border:", response.status);
  //     }
  //   } catch (error) {
  //     console.error("❌ Error loading India border:", error);
  //   }

  //   const stateUrls = [
  //     "https://raw.githubusercontent.com/geohacker/india/master/state/india_telengana.geojson",
  //     "https://raw.githubusercontent.com/Subhash9325/GeoJson-Data-of-Indian-States/master/Indian_States.json",
  //   ];

  //   for (const url of stateUrls) {
  //     try {
  //       const response = await fetch(url);
  //     if (response.ok) {
  //         const data = await response.json();
  //         setStatesData(data);
  //         return;
  //       }
  //     } catch (error) {
  //       continue;
  //     }
  //   }
  // }, []);

  // Apply markers to Google Maps
  const applyMarkersToMap = useCallback((map: any) => {
    const google = window.google;

    // Check if AdvancedMarkerElement is available AND we have a mapId (required)
    const canUseAdvancedMarkers = Boolean(
      google?.maps?.marker?.AdvancedMarkerElement && GOOGLE_MAP_ID
    );

    console.log(`📍 Applying ${filteredLocations.length} markers... (using ${canUseAdvancedMarkers ? 'AdvancedMarkerElement' : 'legacy Marker'})`);
    
    // Clear existing markers
    markersRef.current.forEach((marker) => {
      if (canUseAdvancedMarkers) {
        marker.map = null;
      } else {
        if (marker && marker.setMap) marker.setMap(null);
      }
    });
    markersRef.current = [];

    let successCount = 0;

    filteredLocations.forEach((location, index) => {
      if (typeof location.latitude === 'number' && typeof location.longitude === 'number' && 
          !isNaN(location.latitude) && !isNaN(location.longitude)) {
        try {
          // Get color from API data
          let markerColor = location.color_code || "#3B82F6"; // Default blue

          // Ensure color has # prefix
          if (markerColor && !markerColor.startsWith('#')) {
            markerColor = '#' + markerColor;
          }

          // Validate hex color
          if (!/^#([0-9A-F]{3}){1,2}$/i.test(markerColor)) {
            markerColor = "#3B82F6"; // Fallback to blue
          }

          let marker: any;
          let pinElement: any = null;

          if (canUseAdvancedMarkers) {
            // Create custom pin element using AdvancedMarkerElement PinElement
            pinElement = new google.maps.marker.PinElement({
              background: markerColor,
              borderColor: '#ffffff',
              glyphColor: '#ffffff',
              scale: 1.0,
            });

            // Create AdvancedMarkerElement (replaces deprecated Marker)
            marker = new google.maps.marker.AdvancedMarkerElement({
              map: map,
              position: { lat: location.latitude, lng: location.longitude },
              title: location.location_name || location.name || 'Location',
              content: pinElement.element,
            });
          } else {
            // Fallback to legacy Marker API
            marker = new google.maps.Marker({
            position: { lat: location.latitude, lng: location.longitude },
              map: map,
            title: location.location_name || location.name || 'Location',
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: markerColor,
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
              optimized: true,
          });
          }

          // Create info window with options - always positioned well below marker
          const infoWindow = new google.maps.InfoWindow({
            pixelOffset: new google.maps.Size(0, 120), // Very large offset to position well below marker
            content: `
              <div style="padding: 12px; font-family: Arial, sans-serif; min-width: 240px;">
                <strong style="font-size: 16px; color: #333; margin-bottom: 8px; display: block;">${location.location_name || location.name || 'Location'}</strong>
                ${location.company ? `<div style="font-size: 13px; color: #666; margin: 4px 0;"> Company: ${location.company}</div>` : ''}
                ${location.state ? `<div style="font-size: 13px; color: #666; margin: 4px 0;"> State: ${location.state}</div>` : ''}
                <div style="font-size: 12px; color: #999; margin: 8px 0; padding: 8px 0; border-top: 1px solid #eee;">
                  Coordinates: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}
                </div>
                <div style="display: flex; gap: 8px; margin-top: 12px;">
                  <button 
                    id="streetview-btn-${index}"
                    style="
                      flex: 1;
                      background: linear-gradient(135deg, #4285f4 0%, #3367d6 100%);
                      color: white;
                      border: none;
                      padding: 10px 12px;
                      border-radius: 6px;
                      cursor: pointer;
                      font-size: 13px;
                      font-weight: 600;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      gap: 6px;
                      transition: all 0.2s;
                      box-shadow: 0 2px 4px rgba(66, 133, 244, 0.3);
                    "
                    onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 8px rgba(66, 133, 244, 0.4)'"
                    onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(66, 133, 244, 0.3)'"
                  >
                    <span style="font-size: 16px;">🏢</span>
                    <span> View</span>
                  </button>
                  <button 
                    id="details-btn-${index}"
                    style="
                      flex: 1;
                      background: linear-gradient(135deg, #34a853 0%, #2d8e47 100%);
                      color: white;
                      border: none;
                      padding: 10px 12px;
                      border-radius: 6px;
                      cursor: pointer;
                      font-size: 13px;
                      font-weight: 600;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      gap: 6px;
                      transition: all 0.2s;
                      box-shadow: 0 2px 4px rgba(52, 168, 83, 0.3);
                    "
                    onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 8px rgba(52, 168, 83, 0.4)'"
                    onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(52, 168, 83, 0.3)'"
                  >
                    <span style="font-size: 16px;">ℹ️</span>
                    <span>Details</span>
                  </button>
                </div>
              </div>
            `,
          });

          // Add click event listener - show info window with both options
          const clickHandler = () => {
            // Close any open info windows
            if ((window as any).currentInfoWindow) {
              (window as any).currentInfoWindow.close();
            }
            
            // Always position InfoWindow well below marker to prevent top cutoff
            // Use a very large offset to ensure it's always below and visible
            infoWindow.setOptions({ 
              pixelOffset: new google.maps.Size(0, 150) // Very large offset to ensure top is fully visible
            });
            
            // Open info window - AdvancedMarkerElement uses position instead of anchor
            if (canUseAdvancedMarkers) {
              infoWindow.open({
                map: map,
                position: { lat: location.latitude, lng: location.longitude },
                shouldFocus: false,
              });
            } else {
            infoWindow.open(map, marker);
            }
            (window as any).currentInfoWindow = infoWindow;

            // Final check and adjustment after InfoWindow opens
            google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
              setTimeout(() => {
                const infoWindowContainer = document.querySelector('.gm-style-iw-c') as HTMLElement;
                
                if (infoWindowContainer) {
                  const rect = infoWindowContainer.getBoundingClientRect();
                  const minTopMargin = 100; // Very large safe margin from top to ensure full visibility
                  
                  // If still cut off at top, move it down significantly more
                  if (rect.top < minTopMargin) {
                    const offsetPixels = minTopMargin - rect.top + 80; // Extra large padding to ensure visibility
                    
                    infoWindow.close();
                    infoWindow.setOptions({ 
                      pixelOffset: new google.maps.Size(0, offsetPixels)
                    });
                    
                    setTimeout(() => {
                      if (canUseAdvancedMarkers) {
                        infoWindow.open({
                          map: map,
                          position: { lat: location.latitude, lng: location.longitude },
                          shouldFocus: false,
                        });
                      } else {
                        infoWindow.open(map, marker);
                      }
                      
                      // Double-check after reopening
                      setTimeout(() => {
                        const checkContainer = document.querySelector('.gm-style-iw-c') as HTMLElement;
                        if (checkContainer) {
                          const checkRect = checkContainer.getBoundingClientRect();
                          if (checkRect.top < minTopMargin) {
                            const finalOffset = minTopMargin - checkRect.top + 100;
                            infoWindow.close();
                            infoWindow.setOptions({ 
                              pixelOffset: new google.maps.Size(0, finalOffset)
                            });
                            setTimeout(() => {
                              if (canUseAdvancedMarkers) {
                                infoWindow.open({
                                  map: map,
                                  position: { lat: location.latitude, lng: location.longitude },
                                  shouldFocus: false,
                                });
                              } else {
                                infoWindow.open(map, marker);
                              }
                            }, 50);
                          }
                        }
                      }, 150);
                    }, 50);
                  }
                }
              }, 200); // Increased delay to ensure InfoWindow is fully rendered
            });

            // Add event listeners after info window opens
            setTimeout(() => {
              // Street View button - Zooms to city/street level view
              const streetViewBtn = document.getElementById(`streetview-btn-${index}`);
              if (streetViewBtn) {
                streetViewBtn.onclick = (e: any) => {
                  e.stopPropagation();
                  e.preventDefault();
                  
                  console.log(`🏢 Zooming to building level for ${location.location_name || 'location'} at [${location.latitude}, ${location.longitude}]`);
                  
                  const position = { lat: location.latitude, lng: location.longitude };
                  
                  // Store current view before zooming
                  const previousView = {
                    center: map.getCenter(),
                    zoom: map.getZoom()
                  };
                  
                  // Close info window
                  infoWindow.close();
                  
                  // Zoom to building level (zoom 19 = individual buildings visible)
                  map.panTo(position);
                  
                  // Smooth zoom animation
                  setTimeout(() => {
                    map.setZoom(19); // Building level zoom - shows individual buildings
                    console.log(`✅ Zoomed to building level at exact location`);
                    
                    // Ensure marker is visible and highlighted
                    setTimeout(() => {
                      if (canUseAdvancedMarkers && pinElement) {
                        // AdvancedMarkerElement doesn't support animation, so we'll use a visual effect instead
                        // Add a pulsing effect by temporarily changing scale
                        const originalScale = pinElement.scale;
                        let pulseCount = 0;
                        const pulseInterval = setInterval(() => {
                          pulseCount++;
                          if (pulseCount <= 4) {
                            pinElement.scale = pulseCount % 2 === 0 ? 1.2 : 1.0;
                          } else {
                            pinElement.scale = originalScale;
                            clearInterval(pulseInterval);
                          }
                        }, 200);
                      } else if (!canUseAdvancedMarkers) {
                        // Legacy Marker animation
                      marker.setAnimation(google.maps.Animation.BOUNCE);
                      setTimeout(() => {
                        marker.setAnimation(null);
                      }, 2000);
                      }
                      
                      // Reopen info window to show location details
                      if (canUseAdvancedMarkers) {
                        infoWindow.open({
                          map: map,
                          position: { lat: location.latitude, lng: location.longitude },
                          shouldFocus: false,
                        });
                      } else {
                      infoWindow.open(map, marker);
                      }
                      console.log('✅ Marker highlighted and info window reopened');
                    }, 500);
                    
                    // Show back button
                    showBackButton(previousView);
                  }, 300);
                };
              }
              
              // Function to show back button
              const showBackButton = (previousView: any) => {
                // Remove existing back button if any
                const existingBackBtn = document.getElementById('street-level-back-btn');
                if (existingBackBtn) {
                  existingBackBtn.remove();
                }
                
                // Create back button
                const backButton = document.createElement('button');
                backButton.id = 'street-level-back-btn';
                backButton.innerHTML = `
                  <span style="font-size: 20px;">←</span>
                `;
                backButton.style.cssText = `
                  position: absolute;
                  top: 10px;
                  left: 10px;
                  z-index: 100;
                  padding: 10px 12px;
                  background: #6b7280;
                  color: white;
                  border: none;
                  border-radius: 8px;
                  cursor: pointer;
                  font-size: 20px;
                  font-weight: 600;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                  transition: all 0.3s ease;
                `;
                
                // Hover effects
                backButton.onmouseover = () => {
                  backButton.style.transform = 'translateY(-2px)';
                  backButton.style.background = '#4b5563';
                  backButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
                };
                backButton.onmouseout = () => {
                  backButton.style.transform = 'translateY(0)';
                  backButton.style.background = '#6b7280';
                  backButton.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
                };
                
                // Click to go back
                backButton.onclick = () => {
                  console.log('🔙 Returning to previous view');
                  map.panTo(previousView.center);
                  setTimeout(() => {
                    map.setZoom(previousView.zoom);
                    backButton.remove();
                    console.log('✅ Returned to previous view');
                  }, 300);
                };
                
                // Add to map container
                const mapContainer = document.getElementById('google-map-container');
                if (mapContainer && mapContainer.parentElement) {
                  mapContainer.parentElement.appendChild(backButton);
                  console.log('✅ Back button added');
                }
              };
              
              // Details button
              const detailsBtn = document.getElementById(`details-btn-${index}`);
              if (detailsBtn) {
                detailsBtn.onclick = (e: any) => {
                  e.stopPropagation();
                  e.preventDefault();
                  
                setSelectedLocation(location);
                  infoWindow.close();
                };
              }
            }, 100);
          };

          // Add click listener based on marker type
          if (canUseAdvancedMarkers) {
            marker.addEventListener('click', clickHandler);
          } else {
            marker.addListener('click', clickHandler);
          }

          // Add hover event listeners - AdvancedMarkerElement uses DOM events
          const mouseoverHandler = (e: any) => {
            // Try to get mouse position from event
            let x = 0, y = 0;
            if (e && e.domEvent) {
              x = e.domEvent.pageX || e.domEvent.clientX || 0;
              y = e.domEvent.pageY || e.domEvent.clientY || 0;
            } else if (e && (e.pageX || e.clientX)) {
              x = e.pageX || e.clientX || 0;
              y = e.pageY || e.clientY || 0;
            } else {
              // Fallback: use marker position on map
              const projection = map.getProjection();
              if (projection && location.latitude && location.longitude) {
                const point = projection.fromLatLngToPoint(
                  new google.maps.LatLng(location.latitude, location.longitude)
                );
                const scale = Math.pow(2, map.getZoom() || 10);
                const mapDiv = map.getDiv();
                const mapBounds = mapDiv.getBoundingClientRect();
                x = mapBounds.left + (point.x * scale);
                y = mapBounds.top + (point.y * scale);
              }
            }
            
          setHoveredLocation(location);
            setTooltipPosition({ x: x + 10, y: y + 10 });
          setShowTooltip(true);
          };
        
          const mouseoutHandler = () => {
          setHoveredLocation(null);
            setShowTooltip(false);
          };

          if (canUseAdvancedMarkers) {
            marker.addEventListener('mouseover', mouseoverHandler);
            marker.addEventListener('mouseout', mouseoutHandler);
          } else {
            marker.addListener('mouseover', mouseoverHandler);
            marker.addListener('mouseout', mouseoutHandler);
          }

        markersRef.current.push(marker);
          successCount++;

          if (index < 5) {
            console.log(`✅ Marker ${index + 1}: ${location.location_name} [${markerColor}] at [lat:${location.latitude}, lng:${location.longitude}]`);
          }
        } catch (error) {
          console.error(`❌ Error adding marker:`, error);
        }
      }
    });

    console.log(`✅ Added ${successCount} markers`);
  }, [filteredLocations]);

  // Handle hover functionality
  const handleLocationHover = useCallback((location: Location | null, event?: any) => {
    if (location && event) {
      setHoveredLocation(location);
      setTooltipPosition({ x: event.pageX + 10, y: event.pageY + 10 });
      setShowTooltip(true);
    } else {
      // Don't immediately hide tooltip - let handleLocationClick manage it
    }
  }, []);

  // UPDATED: handleSBUClick function
  const handleSBUClick = useCallback((sbu: string) => {
    // ALWAYS open the filters sidebar when an SBU is clicked
    setFiltersOpen(true);

    setActiveSBUFilter(sbu);

    // Clear date filters when changing SBU (will only be enabled for LPG)
    setSelectedFromDate('');
    setSelectedToDate('');

    // Update selected filters
    setSelectedFilters(prev => ({
      ...prev,
      sbu: '',
      company: sbu ? [] : prev.company,
      zone: sbu ? [] : prev.zone,
      state: sbu ? [] : prev.state,
      district: sbu ? [] : prev.district,
      location_name: sbu ? [] : prev.location_name
    }));

    // Reset pie chart level to company when changing SBU
    setPieChartLevel('company');

    // Clear bounds cache to recalculate for new filter
    boundsCache.current = {};

    // Filter locations by SBU from existing data (don't make API calls)
    if (sbu) {
      const filtered = locations.filter((location: Location) =>
        location.sbu && location.sbu.toLowerCase() === sbu.toLowerCase()
      );
      setFilteredLocations(filtered);

      // Calculate filter options from existing locations for the specific SBU
      const sbuSpecificLocations = locations.filter((location: Location) =>
        location.sbu && location.sbu.toLowerCase() === sbu.toLowerCase()
      );

      const sbuFilterOptions = calculateAllFilterOptions(sbuSpecificLocations);

      console.log('SBU filter options calculated from existing data:', sbuFilterOptions);

      // Update filter options
      setAllFilterOptions(sbuFilterOptions);
      setFilters(sbuFilterOptions);

      // Calculate counts and color mapping from filtered data
      const { counts, colorMapping: newColorMapping } = calculateCountsAndColorMapping(filtered);

      // Update count states with filtered data counts
      setCompanyCounts(counts.company);
      setZoneCounts(counts.zone);
      setStateCounts(counts.state);
      setDistrictCounts(counts.district);
      setLocationCounts(counts.location_name);
      setColorMapping(prev => ({ ...prev, ...newColorMapping }));

    } else {
      // Clear SBU filter - show all data
      setFilteredLocations(locations);

      // Calculate filter options from ALL existing locations
      const allOptions = calculateAllFilterOptions(locations);
      setAllFilterOptions(allOptions);
      setFilters(allOptions);


      // Calculate counts and color mapping for all data
      const { counts, colorMapping: newColorMapping } = calculateCountsAndColorMapping(locations);

      setCompanyCounts(counts.company);
      setZoneCounts(counts.zone);
      setStateCounts(counts.state);
      setDistrictCounts(counts.district);
      setLocationCounts(counts.location_name);
      setColorMapping(prev => ({ ...prev, ...newColorMapping }));
    }

    // Reset table and search
    setShowFilteredTable(false);
    setFilteredData([]);
    setSearchTerm('');
    setSortConfig({ key: '', direction: null });

    // Clear map highlighting
    setSelectedLocation(null);
    setShowTooltip(false);
    setHoveredLocation(null);

  }, [locations, calculateCountsAndColorMapping, calculateAllFilterOptions]);

  // Updated useEffect that handles location changes and date filtering
  useEffect(() => {
    if (locations.length === 0) return;

    let baseFilteredLocations: Location[] = [];

    if (activeSBUFilter) {
      baseFilteredLocations = locations.filter((location: Location) =>
        location.sbu && location.sbu.toLowerCase() === activeSBUFilter.toLowerCase()
      );
    } else {
      baseFilteredLocations = locations;
    }

    // Apply date filtering if LPG is selected
    const dateFilteredLocations = filterLocationsByDate(baseFilteredLocations);
    
    // Apply state filter if a state is selected
    let stateFilteredLocations = dateFilteredLocations;
    const selectedState = getSelectedValue(selectedFilters.state);
    if (selectedState) {
      const normalizedSelectedState = selectedState.trim().toLowerCase();
      const beforeCount = dateFilteredLocations.length;
      stateFilteredLocations = dateFilteredLocations.filter((location: Location) =>
        location.state && location.state.trim().toLowerCase() === normalizedSelectedState
      );
      const afterCount = stateFilteredLocations.length;
      console.log(`🔍 State filter "${selectedState}": ${beforeCount} → ${afterCount} locations`);
      
      // Log sample state names for debugging
      if (afterCount === 0 && beforeCount > 0) {
        const sampleStates = [...new Set(dateFilteredLocations.slice(0, 10).map(loc => loc.state).filter(Boolean))];
        console.log(`📋 Sample states in data:`, sampleStates);
      }
    }
    
    setFilteredLocations(stateFilteredLocations);
    // Calculate counts and color mapping based on filtered data
    const { counts, colorMapping: newColorMapping } = calculateCountsAndColorMapping(stateFilteredLocations);

    // Update count states with filtered data
    setCompanyCounts(counts.company);
    setZoneCounts(counts.zone);
    setStateCounts(counts.state);
    setDistrictCounts(counts.district);
    setLocationCounts(counts.location_name);
    setColorMapping(prev => ({ ...prev, ...newColorMapping }));

  }, [locations, activeSBUFilter, selectedFromDate, selectedToDate, selectedFilters.state, filterLocationsByDate, calculateCountsAndColorMapping, getSelectedValue]);

  // Data fetching functions
  const fetchAllData = useCallback(async () => {
    if (isLoadingData || filtersKey === lastFetchedFilters) return;
     
    setIsLoadingData(true);
 
    try {
      const payload = { filters: filtersPayload, drill_state: '', cross_filters: [], limit: 0, time_grain: '' };
      const [filtersResponse, dataResponse] = await Promise.all([
        apiClient.post('/api/sodinfra/get_distinct_sod_lpg_infra', selectedFilters),
        apiClient.post('/api/sodinfra/get_all_sod_lpg_infra', payload)
      ]);

      const data = dataResponse.data?.data || [];

      const validLocations = data
        .filter((loc: any) => (!isNaN(Number(loc.latitude)) && !isNaN(Number(loc.longitude))) || loc.location_name)
        .map((item: any) => ({
          ...item,
          latitude: isNaN(Number(item.latitude)) ? undefined : Number(item.latitude),
          longitude: isNaN(Number(item.longitude)) ? undefined : Number(item.longitude),
          name: item.location_name || item.name || item.company_name,
        }));

      setLocations(validLocations);

      // UPDATED: Calculate ALL filter options from ALL locations and store separately
      const allOptions = calculateAllFilterOptions(validLocations);
      setAllFilterOptions(allOptions);

      // Also set the regular filters for backward compatibility (but FilterSidebar will use allFilterOptions)
      setFilters(allOptions);

      // Calculate counts and color mapping for the initial data load
      if (!activeSBUFilter) {
        const { counts, colorMapping: newColorMapping } = calculateCountsAndColorMapping(validLocations);

        setCompanyCounts(counts.company);
        setZoneCounts(counts.zone);
        setStateCounts(counts.state);
        setDistrictCounts(counts.district);
        setLocationCounts(counts.location_name);
        setColorMapping(prev => ({ ...prev, ...newColorMapping }));
        setFilteredLocations(validLocations);
      }

      setLastFetchedFilters(filtersKey);
      boundsCache.current = {};

    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoadingData(false);
    }
  }, [filtersPayload, selectedFilters, filtersKey, lastFetchedFilters, isLoadingData, activeSBUFilter, calculateCountsAndColorMapping, calculateAllFilterOptions]);

  const fetchUpdateData = useCallback(async () => {
    setIsLoadingUpdate(true);
    try {
      const sbu = getSelectedValue(selectedFilters.sbu).toLowerCase();
      const endpoints = getApiEndpoints(sbu);
      const response = await apiClient.post(endpoints.getAll, selectedFilters);
      setUpdateTableData(response.data?.data || []);
    } catch (error) {
      console.error("Failed to fetch update data:", error);
    } finally {
      setIsLoadingUpdate(false);
    }
  }, [selectedFilters, getApiEndpoints, getSelectedValue]);

  const fetchFilteredData = useCallback(async () => {
    if (!isSBUSelected()) {
      toast.error("Please select SBU!", { description: "You must select an SBU before applying filters.", duration: 3000 });
      return;
    }

    try {
      const payload = { filters: filtersPayload, drill_state: '', cross_filters: [], limit: 0, time_grain: '' };
      const response = await apiClient.post('/api/sodinfra/get_sod_lpg_infra', payload);
      setFilteredData(response.data?.data || []);
      setShowFilteredTable(true);
    } catch (error) {
      console.error('Failed to fetch filtered data:', error);
      toast.error("Failed to fetch data", { description: "There was an error fetching the filtered data.", duration: 3000 });
    }
  }, [isSBUSelected, filtersPayload]);

  // Event handlers
  const handleDateRangeChange = useCallback((fromDate: string, toDate: string) => {
    setSelectedFromDate(fromDate);
    setSelectedToDate(toDate);
    console.log('Selected date range:', { fromDate, toDate });
  }, []);

  const handleUpdateClick = useCallback(() => {
    setShowUpdateDialog(true);
    fetchUpdateData();
  }, [fetchUpdateData]);

  const handleEditClick = useCallback((row: UpdateTableRow) => {
    setEditingRowId(row.id || Math.random().toString());
    setEditedRow({ ...row });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingRowId(null);
    setEditedRow({});
  }, []);

  const handleEditInputChange = useCallback((field: string, value: string) => {
    setEditedRow(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSort = useCallback((key: string) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key) {
      direction = sortConfig.direction === 'asc' ? 'desc' : sortConfig.direction === 'desc' ? null : 'asc';
    }
    setSortConfig({ key, direction });
  }, [sortConfig]);

  const clearFilters = useCallback(() => {
    setSelectedFilters(prev =>
      Object.fromEntries(Object.entries(prev).map(([key, value]) => [key, Array.isArray(value) ? [] : '']))
    );
    setFilteredData([]);
    setShowFilteredTable(false);
    setPieChartLevel('company');
    setSearchTerm('');
    setSortConfig({ key: '', direction: null });
    setActiveSBUFilter(''); // Clear SBU filter
    
    // Clear date filters
    setSelectedFromDate('');
    setSelectedToDate('');
    
    boundsCache.current = {};
    lastHighlightedFilter.current = '';
    setSelectedLocation(null);
    setShowTooltip(false);
    setHoveredLocation(null);

    // Recalculate counts and color mapping for all data when clearing filters
    const { counts, colorMapping: newColorMapping } = calculateCountsAndColorMapping(locations);

    setCompanyCounts(counts.company);
    setZoneCounts(counts.zone);
    setStateCounts(counts.state);
    setDistrictCounts(counts.district);
    setLocationCounts(counts.location_name);
    setColorMapping(prev => ({ ...prev, ...newColorMapping }));
    setFilteredLocations(locations);
  }, [locations, calculateCountsAndColorMapping]);

  // SBU-specific functions
  const createPayloadForSBU = useCallback(
    (sbu: string, editedRow: UpdateTableRow, editingRowId: string | null) => {
      const baseFields = {
        unique_id: editingRowId ? String(editingRowId) : "",
        sap_id: editedRow.sap_id || "",
        sbu: editedRow.sbu || "",
        zone: editedRow.zone || "",
        state: editedRow.state || "",
        district: editedRow.district || "",
        city: editedRow.city || "",
        address: editedRow.address || "",
        region: editedRow.region || "",
        company: editedRow.company || "",
        location_name: editedRow.location_name || "",
        name: editedRow.name || "",
        latitude: Number(editedRow.latitude) || 0,
        longitude: Number(editedRow.longitude) || 0,
        filename: editedRow.filename || "",
        updated_by: editedRow.updated_by || "",
      };

      const sbuFields = {
        lpg: {
          installed_bottling_capacity: Number(editedRow.installed_bottling_capacity) || 0,
          operating_bottling_capacity: Number(editedRow.operating_bottling_capacity) || 0,
          ccoe_tankage: Number(editedRow.ccoe_tankage) || 0,
          time_of_commissioning: editedRow.time_of_commissioning || "",
          mode: editedRow.mode || "",
          supply: editedRow.supply || "",
        },
        sod: {
          type: editedRow.type || "",
          region_ppac: editedRow.region_ppac || "",
          ms: Number(editedRow.ms) || 0,
          sko: Number(editedRow.sko) || 0,
          hsd: Number(editedRow.hsd) || 0,
          total: Number(editedRow.total) || 0,
          mode_of_receipt: editedRow.mode_of_receipt || "",
        },
        lubes: {
          capacity: Number(editedRow.capacity) || 0,
          product_type: editedRow.product_type || "",
          grade: editedRow.grade || "",
        },
        aviation: {
          fuel_type: editedRow.fuel_type || "",
          storage_capacity: Number(editedRow.storage_capacity) || 0,
          runway_length: Number(editedRow.runway_length) || 0,
        },
      };

      const lowerSBU = sbu.toLowerCase();

      if (lowerSBU === "sod") {
        return {
          sod_data: {
            ...baseFields,
            ...(sbuFields[lowerSBU as keyof typeof sbuFields] || {}),
          },
        };
      }

      if (lowerSBU === "lpg") {
        return {
          lpg_data: {
            ...baseFields,
            ...(sbuFields[lowerSBU as keyof typeof sbuFields] || {}),
          },
        };
      }
      if (lowerSBU === "aviation") {
        return {
          aviation_data: {
            ...baseFields,
            ...(sbuFields[lowerSBU as keyof typeof sbuFields] || {}),
          },
        };
      }
      if (lowerSBU === "lubes") {
        return {
          lubes_data: {
            ...baseFields,
            ...(sbuFields[lowerSBU as keyof typeof sbuFields] || {}),
          },
        };
      }

      return {
        ...baseFields,
        ...(sbuFields[lowerSBU as keyof typeof sbuFields] || {}),
      };
    },
    []
  );

  const handleSaveEdit = useCallback(async () => {
    try {
      const sbu = getSelectedValue(selectedFilters.sbu).toLowerCase();
      const endpoints = getApiEndpoints(sbu);
      const payload = createPayloadForSBU(sbu, editedRow, editingRowId);

      console.log("Update Payload:", payload);

      const response = await apiClient.post(endpoints.update, payload);

      if (response.status === 200) {
        await fetchUpdateData();
        setEditingRowId(null);
        setEditedRow({});
        toast.success("Record updated successfully!");
      }
    } catch (error: any) {
      console.error("Failed to save edit:", error.response?.data || error.message);
      alert("Failed to save changes. Please check the form and try again.");
    }
  }, [selectedFilters, getApiEndpoints, createPayloadForSBU, editedRow, editingRowId, getSelectedValue, fetchUpdateData]);

  const handleBulkDelete = useCallback(async () => {
    const sbu = getSelectedValue(selectedFilters.sbu).toLowerCase();
    const endpoints = getApiEndpoints(sbu);
    const selectedRows = updateTableData.filter(row => row.selected);

    if (selectedRows.length === 0) {
      toast("Please select rows to delete");
      return;
    }

    if (window.confirm(`Delete ${selectedRows.length} selected record(s)?`)) {
      try {
        // Collect all selected IDs as strings
        const ids = selectedRows.map(row => String(row.id));

        // Send payload as { unique_id: [] }
        const payload = { unique_id: ids };

        const response = await apiClient.post(endpoints.delete, payload);

        if (response.status === 200) {
          // Remove deleted rows from state
          setUpdateTableData(prev => prev.filter(r => !r.selected));
          toast.success(`${selectedRows.length} record(s) deleted successfully!`);
        } else {
          alert("Some records could not be deleted.");
        }
      } catch (error) {
        console.error("Failed to delete records:", error);
        alert("Bulk delete failed.");
      }
    }
  }, [selectedFilters, getApiEndpoints, updateTableData, getSelectedValue]);

  const getDataTypeFromSbu = useCallback((sbu: string): 'sod' | 'lubes' | 'aviation' | 'lpg' => {
    if (!sbu) return 'sod'; // fallback

    const sbuLower = sbu.toLowerCase();
    switch (sbuLower) {
      case 'lpg':
        return 'lpg';
      case 'lubes':
        return 'lubes';
      case 'aviation':
        return 'aviation';
      case 'sod':
      default:
        return 'sod';
    }
  }, []);

  // File upload functions
  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return;

    const sbu = getSelectedValue(selectedFilters.sbu)?.toLowerCase?.();
    if (!VALID_SBUS.includes(sbu)) {
      setUploadStatus({ isUploading: false, success: false, error: 'Invalid SBU for upload', fileName: file.name });
      return;
    }

    setUploadStatus({ isUploading: true, success: false, error: null, fileName: file.name });

    const formData = new FormData();
    formData.append('file', file);
    const endpoints = getApiEndpoints(sbu);

    try {
      const response = await fetch(endpoints.upload, { method: 'POST', body: formData });
      if (!response.ok) throw new Error(`Upload failed at ${endpoints.upload} - Status ${response.status}`);
      await response.json();
      setUploadStatus({ isUploading: false, success: true, error: null, fileName: file.name });
      fetchAllData();
    } catch (error: any) {
      console.error(error);
      setUploadStatus({ isUploading: false, success: false, error: error.message || 'Upload failed', fileName: file.name });
    }
  }, [selectedFilters.sbu, getApiEndpoints, fetchAllData, getSelectedValue]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const resetUploadStatus = useCallback(() => {
    setUploadStatus({ isUploading: false, success: false, error: null, fileName: null });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // Chart and UI functions
  const getChartTitle = useCallback(() => {
    const titles = { company: 'Company Distribution', zone: 'Zone Distribution', state: 'State Distribution', district: 'District Distribution', location_name: 'Location Distribution' };
    return titles[pieChartLevel] || 'Distribution Chart';
  }, [pieChartLevel]);

  const canGoBack = useCallback(() => pieChartLevel !== 'company', [pieChartLevel]);

  const goToPreviousLevel = useCallback(() => {
    const levels: Array<'company' | 'zone' | 'state' | 'district' | 'location_name'> = ['company', 'zone', 'state', 'district', 'location_name'];
    const currentIndex = levels.indexOf(pieChartLevel);

    if (currentIndex > 0) {
      const previousLevel = levels[currentIndex - 1];
      setPieChartLevel(previousLevel);

      setSelectedFilters(prev => {
        const newFilters = { ...prev };
        const levelsToReset = levels.slice(currentIndex);
        levelsToReset.forEach(level => {
          const key = level === 'location_name' ? 'location_name' : level;
          newFilters[key] = Array.isArray(newFilters[key]) ? [] : '';
        });
        return newFilters;
      });
    }
  }, [pieChartLevel]);

  const resetPieChart = useCallback(() => {
    setPieChartLevel('company');
    setSelectedFilters(prev => ({
      ...prev,
      company: Array.isArray(prev.company) ? [] : '',
      zone: Array.isArray(prev.zone) ? [] : '',
      state: Array.isArray(prev.state) ? [] : '',
      district: Array.isArray(prev.district) ? [] : '',
      location_name: Array.isArray(prev.location_name) ? [] : ''
    }));
  }, []);

  const getSortIcon = useCallback((columnKey: string) => {
    const defaultIcon = (
      <div className="flex flex-col ml-1 opacity-40">
        <ChevronUp className="w-3 h-3 -mb-1" />
        <ChevronDown className="w-3 h-3" />
      </div>
    );

    if (sortConfig.key !== columnKey) return defaultIcon;

    if (sortConfig.direction === 'asc') return <ChevronUp className="w-4 h-4 ml-1 text-blue-400" />;
    if (sortConfig.direction === 'desc') return <ChevronDown className="w-4 h-4 ml-1 text-blue-400" />;
    return defaultIcon;
  }, [sortConfig]);

  const getFilterIcon = useCallback((filterKey: string) =>
    ICON_MAP[filterKey] || <Filter className="w-4 h-4" />, []);

  const shouldShowUpload = useCallback(() => true, []);

  // Effects
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Handle window resize for responsive map
  useEffect(() => {
    const handleResize = () => {
      const map = mapInstanceRef.current;
      const google = window.google;
      if (map && google) {
        // Trigger Google Maps resize event
        google.maps.event.trigger(map, 'resize');
        // Optionally adjust zoom based on new screen size
        const responsiveZoom = getResponsiveZoom();
        if (filteredLocations.length === 0) {
          map.setZoom(responsiveZoom);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getResponsiveZoom, filteredLocations.length]);

  useEffect(() => {
    let processedData = [...filteredData];

    if (searchTerm) {
      processedData = processedData.filter(item =>
        Object.values(item).some(value =>
          value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    if (sortConfig.key && sortConfig.direction) {
      processedData.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return sortConfig.direction === 'asc' ? 1 : -1;
        if (bValue == null) return sortConfig.direction === 'asc' ? -1 : 1;

        const aNum = Number(aValue);
        const bNum = Number(bValue);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
        }

        const aStr = aValue.toString().toLowerCase();
        const bStr = bValue.toString().toLowerCase();
        return sortConfig.direction === 'asc'
          ? (aStr < bStr ? -1 : aStr > bStr ? 1 : 0)
          : (aStr > bStr ? -1 : aStr < bStr ? 1 : 0);
      });
    }

    setDisplayData(processedData);
  }, [filteredData, sortConfig, searchTerm]);

  // Pie chart effect
  useLayoutEffect(() => {
    if (!pieChartRef.current) return;

    const chartData = Object.entries(currentCounts)
      .filter(([key]) => {
        const color = colorMapping[key];
        return color && /^#([0-9A-F]{3}){1,2}$/i.test(color);
      })
      .map(([key, value]) => ({
        category: key,
        value,
        color: colorMapping[key]
      }));

    if (chartData.length === 0) return;

    if (pieChartRoot.current) {
      pieChartRoot.current.dispose();
      pieChartRoot.current = null;
    }

    const root = am5.Root.new(pieChartRef.current);
    pieChartRoot.current = root;
    root._logo?.dispose();
    root.setThemes([am5themes_Animated.new(root)]);

    const chart = root.container.children.push(
      am5percent.PieChart.new(root, {
        radius: am5.percent(90),
        innerRadius: am5.percent(50)
      })
    );

    const series = chart.series.push(
      am5percent.PieSeries.new(root, {
        valueField: "value",
        categoryField: "category",
        alignLabels: false
      })
    );

    pieChartSeries.current = series;

    series.slices.template.setAll({
      strokeWidth: 2,
      stroke: am5.color("#1e293b"),
      cornerRadius: 4,
      shadowOffsetX: 2,
      shadowOffsetY: 2,
      shadowColor: am5.color("#000000"),
      shadowOpacity: 0.3,
      cursorOverStyle: "pointer"
    });

    let isClickHandlerActive = false;

    series.slices.template.events.on("click", (ev) => {
      if (isClickHandlerActive) return;
      isClickHandlerActive = true;

      setTimeout(() => {
        const dataItem = ev.target.dataItem;
        const dataContext = dataItem?.dataContext as { category: string } | undefined;
        const itemName = dataContext?.category;

        if (itemName) {
          const levelActions = {
            company: () => { setSelectedFilters(prev => ({ ...prev, company: [itemName] })); setPieChartLevel('zone'); },
            zone: () => { setSelectedFilters(prev => ({ ...prev, zone: [itemName] })); setPieChartLevel('state'); },
            state: () => { setSelectedFilters(prev => ({ ...prev, state: [itemName] })); setPieChartLevel('district'); },
            district: () => { setSelectedFilters(prev => ({ ...prev, district: [itemName] })); setPieChartLevel('location_name'); },
            location_name: () => { setSelectedFilters(prev => ({ ...prev, location_name: [itemName] })); }
          };
          levelActions[pieChartLevel]?.();
        }

        setTimeout(() => { isClickHandlerActive = false; }, 300);
      }, 50);
    });

    series.labels.template.setAll({
      textType: "circular",
      centerX: 0,
      centerY: 0,
      fontSize: "10px",
      fill: am5.color("#ffffff"),
      text: "{category}: {value}"
    });

    series.slices.template.adapters.add("fill", (fill, target) => {
      const data = target.dataItem?.dataContext as { color?: string } | undefined;
      return data?.color ? am5.color(data.color) : am5.color("#000000");
    });

    series.data.setAll(chartData);

    const total = chartData.reduce((sum, item) => sum + item.value, 0);
    chart.seriesContainer.children.push(
      am5.Label.new(root, {
        text: `Total\n${total.toLocaleString()}`,
        centerX: am5.percent(50),
        centerY: am5.percent(50),
        textAlign: "center",
        fontSize: "16px",
        fontWeight: "bold",
        fill: am5.color("#ffffff"),
        background: am5.RoundedRectangle.new(root, {
          fill: am5.color("#1e293b"),
          fillOpacity: 0.8,
          cornerRadiusTL: 8,
          cornerRadiusTR: 8,
          cornerRadiusBL: 8,
          cornerRadiusBR: 8
        }),
        paddingTop: 8,
        paddingBottom: 8,
        paddingLeft: 12,
        paddingRight: 12
      })
    );

    setTimeout(() => {
      if (!series.isDisposed()) {
        series.appear(300, 0);
      }
    }, 0);

    hasInitialData.current = true;

    return () => {
      if (pieChartRoot.current) {
        pieChartRoot.current.dispose();
        pieChartRoot.current = null;
      }
      pieChartSeries.current = null;
    };
  }, [currentCounts, colorMapping, pieChartLevel]);

  useEffect(() => {
    if (pieChartSeries.current && !pieChartSeries.current.isDisposed() && hasInitialData.current) {
      const chartData = Object.entries(currentCounts)
        .filter(([key]) => {
          const color = colorMapping[key];
          return color && /^#([0-9A-F]{3}){1,2}$/i.test(color);
        })
        .map(([key, value]) => ({
          category: key,
          value,
          color: colorMapping[key]
        }));

      if (chartData.length > 0) {
        const currentCategories = pieChartSeries.current.data.values.map((item: any) => item.category).sort();
        const newCategories = chartData.map(item => item.category).sort();
        const isSameStructure = JSON.stringify(currentCategories) === JSON.stringify(newCategories);

        if (isSameStructure) {
          chartData.forEach((newItem) => {
            const existingItem = pieChartSeries.current.data.values.find((item: any) => item.category === newItem.category);
            if (existingItem) {
              existingItem.value = newItem.value;
            }
          });
          pieChartSeries.current.markDirtyValues();
        }
      }
    }
  }, [currentCounts]);

  // Wait for Google Maps API to load
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 100;
    
    const checkGoogleMaps = () => {
      attempts++;
      if (window.google && window.google.maps) {
        console.log("✅ Google Maps API loaded successfully");
        setMapLoaded(true);
      } else if (attempts < maxAttempts) {
        setTimeout(checkGoogleMaps, 100);
      } else {
        console.error("❌ Google Maps API failed to load after", maxAttempts * 100, "ms");
      }
    };
    
    setTimeout(checkGoogleMaps, 500);
  }, []);

  // Load GeoJSON borders for Google Maps
  const loadGeoJSONBorders = useCallback(async (map: any, google: any) => {
    // Try to load India border
    const borderUrls = [
      'https://raw.githubusercontent.com/datameet/maps/master/Country/india-osm.geojson',
    ];

    for (const url of borderUrls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();

          map.data.addGeoJson(data);
          map.data.setStyle({
            strokeColor: '#000000',
          strokeWeight: 2.5,
          fillOpacity: 0,
        });

          console.log('✅ India border loaded successfully');
          break;
        }
      } catch (error) {
        console.log(`⚠️ Failed to load from ${url}, trying next...`);
      }
    }

    // Try to load state borders
    const stateUrls = [
      // 'https://raw.githubusercontent.com/datameet/maps/master/State_Boundary/India-States.json',
      // 'https://raw.githubusercontent.com/datameet/indian-states/master/india_states.geojson',
      // 'https://raw.githubusercontent.com/geohacker/india/master/state/india_telengana.geojson',
      // 'https://raw.githubusercontent.com/datameet/maps/master/States/india-states.geojson'
    ];

    for (const url of stateUrls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();

          // Filter out J&K and Ladakh to avoid double lines
          const filteredFeatures = data.features?.filter((feature: any) => {
          const stateName = 
            feature?.properties?.NAME_1 || 
            feature?.properties?.name || 
            feature?.properties?.NAME ||
            feature?.properties?.ST_NM ||
            feature?.properties?.State ||
            feature?.properties?.state_name ||
            "";
          const stateNameLower = stateName.toLowerCase().trim();
          return (
            !stateNameLower.includes("ladakh") &&
            !stateNameLower.includes("kashmir") &&
            !stateNameLower.includes("jammu")
          );
        });

          const filteredData = {
            ...data,
            features: filteredFeatures || data.features,
          };

          // Add to the same data layer with thinner lines
          map.data.addGeoJson(filteredData);
          map.data.setStyle((feature: any) => {
            // Check if this is a state boundary
            const isState = feature.getProperty('NAME_1') ||
              feature.getProperty('ST_NM') ||
              feature.getProperty('State');

            return {
              strokeColor: '#000000',
              strokeWeight: isState ? 1.5 : 2.5,
          fillOpacity: 0,
            };
          });

          console.log('✅ State borders loaded successfully');
          break;
        }
      } catch (error) {
        console.log(`⚠️ Failed to load from ${url}, trying next...`);
      }
    }
  }, []);

  // Initialize Google Maps ONLY ONCE when API loads
  useEffect(() => {
    if (!mapLoaded || !mapContainerRef.current || mapInstanceRef.current) return;

    if (!(mapContainerRef.current instanceof HTMLElement)) {
      console.error('❌ Map container is not a valid HTMLElement');
      return;
    }

    const attemptInit = () => {
      if (!mapContainerRef.current) return;
      const google = window.google;
      if (!google?.maps?.Map) {
        if (mapInitRetryRef.current < 50) {
          mapInitRetryRef.current += 1;
          setTimeout(attemptInit, 200); // retry until google.maps is ready
        } else {
          console.error('❌ Google Maps library not ready (google.maps.Map missing)');
        }
        return;
      }

      try {
        // Create map centered on India - Complete view with full north
        const map = new google.maps.Map(mapContainerRef.current, {
          center: { lat: 21.5, lng: 79.0 }, // Centered to show complete India from Kashmir to Kanyakumari
          zoom: 4.9,
          mapTypeId: mapStyle === 'satellite' ? 'hybrid' : 'roadmap',
          mapTypeControl: false,
          streetViewControl: false, // Disable Street View (peg man)
          fullscreenControl: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          minZoom: 4, // Prevent zooming out too far
          maxZoom: 20, // Allow street-level zoom
          mapId: GOOGLE_MAP_ID || undefined,
          restriction: {
            // Keep focus on India and surrounding region
            latLngBounds: {
              north: 37,
              south: 6,
              west: 68,
              east: 98,
            },
            strictBounds: false, // Allow some panning outside
          },
        });

        mapInstanceRef.current = map;
        mapInitRetryRef.current = 0;

        // Monitor tile loading
        google.maps.event.addListener(map, 'tilesloaded', () => {
          console.log('✅ Google Maps tiles loaded successfully');
        });

        // Load GeoJSON borders
        loadGeoJSONBorders(map, google);

        console.log('✅ Map initialized successfully with Google Maps');
      } catch (error) {
        console.error('❌ Error initializing Google Maps:', error);
      }
    };

    attemptInit();
  }, [mapLoaded, mapStyle, loadGeoJSONBorders]);

  // Add markers when locations change AND auto-zoom
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return;
    
    const map = mapInstanceRef.current;
    const google = window.google;
    
    // Apply markers first
    applyMarkersToMap(map);

    // Auto-zoom to fit markers after a brief delay to ensure markers are rendered
    const selectedState = getSelectedValue(selectedFilters.state);
    
    if (filteredLocations.length > 0) {
      setTimeout(() => {
        try {
          const validLocs = filteredLocations.filter(
            (loc) => typeof loc.latitude === 'number' && typeof loc.longitude === 'number'
          );

          if (validLocs.length === 1) {
            const loc = validLocs[0];
            console.log(`🎯 Centering on single location: ${loc.location_name} at [lat:${loc.latitude}, lng:${loc.longitude}]`);
            // Smooth pan to location
            map.panTo({ lat: loc.latitude, lng: loc.longitude });
            // Set zoom with smooth animation
            setTimeout(() => {
              map.setZoom(17); // Deep zoom for street-level view
              console.log(`✅ Centered map at [lat:${loc.latitude}, lng:${loc.longitude}] with zoom 17 (street level)`);
            }, 300);
          } else if (validLocs.length > 1) {
            // Create Google Maps bounds
            const bounds = new google.maps.LatLngBounds();

            validLocs.forEach((loc) => {
              bounds.extend({ lat: loc.latitude, lng: loc.longitude });
            });

            console.log(`🗺️ Fitting ${validLocs.length} locations to bounds for state: ${selectedState || 'all'}`);

            // Fit the map to the bounds with padding
            const responsivePadding = getResponsivePadding();
            map.fitBounds(bounds, responsivePadding);
            
            // For state-level filtering, allow deeper zoom
            const minZoom = selectedState ? 6 : 4.9; // Allow deeper zoom when state is selected
            
            // Ensure zoom doesn't go below minimum view
            const listener = google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
              if (map.getZoom() && map.getZoom() < minZoom) {
                map.setZoom(minZoom);
              }
            });
          }
        } catch (error) {
          console.error("Error auto-zooming:", error);
        }
      }, 100); // Small delay to ensure markers are placed
    } else if (selectedState) {
      // If state is selected but no locations, try to zoom to state bounds using GeoJSON
      setTimeout(() => {
        try {
          console.log(`🗺️ No locations found for ${selectedState}, attempting to zoom to state bounds`);
          // Try to find state in map data layers
          if (map.data) {
            map.data.forEach((feature: any) => {
              const featureStateName = (
                feature.getProperty('NAME_1') ||
                feature.getProperty('name') ||
                feature.getProperty('ST_NM') ||
                feature.getProperty('State') ||
                ''
              ).trim().toLowerCase();
              
              if (featureStateName === selectedState.trim().toLowerCase()) {
                const geometry = feature.getGeometry();
                if (geometry) {
                  const bounds = new google.maps.LatLngBounds();
                  geometry.forEachLatLng((latLng: any) => {
                    bounds.extend(latLng);
                  });
                  
                  if (!bounds.isEmpty()) {
                    console.log(`✅ Found state bounds for ${selectedState}, zooming...`);
                    const responsivePadding = getResponsivePadding();
                    map.fitBounds(bounds, responsivePadding);
                    return;
                  }
                }
              }
            });
          }
        } catch (error) {
          console.error("Error zooming to state bounds:", error);
        }
      }, 200);
    } else {
      // Reset to India center view if no filtered locations and no state selected
      map.panTo({ lat: 21.5, lng: 79.0 });
      map.setZoom(4.9);
      console.log('🗺️ No filtered locations - showing full India view');
    }
  }, [mapLoaded, filteredLocations, applyMarkersToMap, getResponsivePadding, selectedFilters.state, getSelectedValue]);

  // Change map type when mapStyle changes (Google Maps)
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const google = window.google;

    if (mapStyle === 'satellite') {
      map.setMapTypeId(google.maps.MapTypeId.HYBRID);
      console.log('🛰️ Switched to satellite view');
    } else {
      map.setMapTypeId(google.maps.MapTypeId.ROADMAP);
      console.log('🗺️ Switched to roadmap view');
    }
  }, [mapStyle, mapLoaded]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach((marker) => {
        if (marker) marker.map = null;
      });
      overlaysRef.current.forEach((overlay) => {
        if (overlay && overlay.setMap) overlay.setMap(null);
      });
    };
  }, []);

  // State-specific map effect - Updated to use filteredLocations
  useLayoutEffect(() => {
    if (!selectedFilters.state || !stateMapRef.current) return;

    const root = am5.Root.new(stateMapRef.current);
    root._logo?.dispose();

    const theme = am5themes_Animated.new(root);
    theme.rule("Graphics", ["theme"]).setAll({ forceInactive: true });
    root.setThemes([theme]);

   const chart = root.container.children.push(
      am5map.MapChart.new(root, {
    panX: 'none',
    panY: 'none',
    wheelX: 'none',
    wheelY: 'none',
    projection: am5map.geoMercator(),
  })
);
    const selectedState = getSelectedValue(selectedFilters.state);
    const normalizedSelectedState = selectedState.trim().toLowerCase();

    const filteredGeoJSON = {
      type: 'FeatureCollection',
      features: (am5geodata_india2019High as any).features.filter(
        (feature: any) => {
          const featureStateName = feature.properties?.name?.trim().toLowerCase() || '';
          return featureStateName === normalizedSelectedState;
        }
      ),
    };

    const polygonSeries = chart.series.push(
      am5map.MapPolygonSeries.new(root, {
        geoJSON: filteredGeoJSON as any,
        fill: am5.color('#FFFFF0'),
        stroke: am5.color('#FFFFF0'),
      })
    );

    const statePointSeries = chart.series.push(
      am5map.MapPointSeries.new(root, {
        latitudeField: 'latitude',
        longitudeField: 'longitude',
      })
    );

    // Use filteredLocations instead of locations for state-specific map
    const stateFilteredLocations = filteredLocations.filter((loc: Location) => 
      loc?.state && loc.state.trim().toLowerCase() === normalizedSelectedState
    );

    statePointSeries.bullets.push(
  (
    root: am5.Root,
        series: am5.Series,
    dataItem: am5.DataItem<am5map.IMapPointSeriesDataItem>
  ) => {
    const ctx = dataItem.dataContext as Location;
    let pinColor: string | null = null;

    if (ctx.color_code) {
      let colorCode = ctx.color_code.toString().trim();
      if (!colorCode.startsWith('#')) colorCode = '#' + colorCode;
      if (/^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(colorCode)) {
        pinColor = colorCode;
      }
    }

    if (!pinColor) {
      return am5.Bullet.new(root, { 
        sprite: am5.Graphics.new(root, { visible: false }) 
      });
    }

    const pin = am5.Graphics.new(root, {
      svgPath: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
      scale: 0.5,
      fill: am5.color(pinColor),
      centerX: am5.p50,
      centerY: am5.p50,
      cursorOverStyle: 'pointer',
    });

    // Add hover event handlers for state map
    pin.events.on('pointerover', (ev) => {
      const event = ev.originalEvent as PointerEvent;
      handleLocationHover(ctx, event);
    });

    pin.events.on('pointerout', () => {
      handleLocationHover(null);
    });

    pin.events.on('click', () => setSelectedLocation(ctx));
    
    return am5.Bullet.new(root, { sprite: pin });
  }
);
    if (stateFilteredLocations.length > 0) {
      statePointSeries.data.setAll(stateFilteredLocations);
    }

    polygonSeries.events.once('datavalidated', () => {
      const bounds = (polygonSeries as any)._getBounds?.();
      if (bounds) {
        chart.zoomToGeoBounds(bounds, 0);
      } else {
        chart.goHome(0);
      }
    });

    return () => root.dispose();
  }, [selectedFilters.state, filteredLocations, getSelectedValue, handleLocationHover]);

  // Check if state filter is active
  const isStateFilterActive = () => {
    if (!selectedFilters.state) return false;

    if (Array.isArray(selectedFilters.state)) {
      return selectedFilters.state.length > 0 && selectedFilters.state.some(state => state.trim() !== '');
    }

    return typeof selectedFilters.state === 'string' && selectedFilters.state.trim() !== '';
  };

  const selectedsbu = selectedFilters.sbu;

  return (
    <div className="flex flex-col w-full h-[85vh] bg-gradient-to-br from-black-950 via-black-950 to-black-950">
      {/* Show tooltip when hovering */}
      {showTooltip && hoveredLocation && (
        <div
          className="absolute z-50 bg-black/90 text-white p-3 rounded-lg shadow-xl border border-slate-600/50 backdrop-blur-sm pointer-events-none"
          style={{ left: tooltipPosition.x, top: tooltipPosition.y }}
        >
          <div className="text-sm font-semibold">{hoveredLocation.location_name || hoveredLocation.name}</div>
          {hoveredLocation.company && <div className="text-xs text-blue-200">Company: {hoveredLocation.company}</div>}
          {hoveredLocation.sbu && <div className="text-xs text-green-200">SBU: {hoveredLocation.sbu.toUpperCase()}</div>}
          {hoveredLocation.state && <div className="text-xs text-yellow-200">State: {hoveredLocation.state}</div>}
          {/* Show commissioning date for LPG locations */}
          {isLPGSelected() && hoveredLocation.time_of_commissioning && (
            <div className="text-xs text-purple-200">Commissioned: {new Date(hoveredLocation.time_of_commissioning).toLocaleDateString()}</div>
          )}
        </div>
      )}

      <div className="flex flex-grow shadow-2xl">
        <FilterSidebar
          filtersOpen={filtersOpen}
          setFiltersOpen={setFiltersOpen}
          filters={filters}
          selectedFilters={selectedFilters}
          setSelectedFilters={setSelectedFilters}
          shouldShowUpload={shouldShowUpload}
          setShowUploadDialog={setShowUploadDialog}
          clearFilters={clearFilters}
          fetchFilteredData={fetchFilteredData}
          getFilterIcon={getFilterIcon}
        />

        <div className="flex-1 left-1 relative bg-slate-800/50 backdrop-blur-sm">
          {/* Google Map Container */}
          <div ref={mapContainerRef} id="google-map-container" className="w-full h-full rounded-lg" />
          
          {/* Hide Google Maps bottom links */}
          <style>{`
            #google-map-container .gm-style-cc {
              display: none !important;
            }
            #google-map-container a[href^="https://maps.google.com/maps"] {
              display: none !important;
            }
            #google-map-container .gmnoprint a,
            #google-map-container .gmnoprint span,
            #google-map-container .gm-style-cc {
              display: none !important;
            }
            #google-map-container .gmnoprint div {
              background: none !important;
            }
          `}</style>

          {/* Loading indicator */}
          {!mapLoaded && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40 bg-white p-6 rounded-lg shadow-xl">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                <span className="text-gray-700 font-medium">Loading Google Maps...</span>
                <span className="text-xs text-gray-500">
                  {window.google ? "API loaded, initializing..." : "Loading API..."}
                </span>
              </div>
            </div>
          )}

          {/* Map Type Toggle Button - Satellite/Roadmap */}
          {mapLoaded && (
            <button
              onClick={toggleMapType}
              className="absolute top-20 right-2 z-30 px-3 py-2 bg-white hover:bg-gray-50 rounded-lg shadow-lg border border-gray-200 transition-all duration-200 flex items-center justify-center"
              title={mapStyle === 'satellite' ? 'Switch to Roadmap' : 'Switch to Satellite View'}
            >
              {mapStyle === 'satellite' ? (
                <span className="text-gray-700 text-lg">🛰️</span>
              ) : (
                <span className="text-gray-700 text-lg">🗺️</span>
              )}
            </button>
          )}

          {/* Clickable SBU Filter Images */}
          <StaticImages onSBUClick={handleSBUClick} activeSBU={activeSBUFilter} />

          {/* Loading indicator for data */}
          {isLoadingData && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40 bg-black/80 text-white p-4 rounded-lg backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Loading data...</span>
              </div>
            </div>
          )}

          {/* Map Instructions */}

        </div>

        <div className="w-80 bg-slate-900/95 backdrop-blur-sm text-white p-4 border-l border-slate-600/50 overflow-auto">
          <div className="flex gap-2 mb-4">
            {/* Date Range Picker - Only enabled for LPG */}
            <div className={isLPGSelected() ? '' : 'opacity-50 pointer-events-none'}>
              <DateRangePickerComponent
                selectedFromDate={selectedFromDate}
                selectedToDate={selectedToDate}
                onDateRangeChange={handleDateRangeChange}
              />
            </div>

            {canUpdate() && (
              <button
                onClick={handleUpdateClick}
                className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg text-xs font-medium transition-all duration-200 shadow-md hover:shadow-blue-500/25 text-white"
                title="Update Data"
              >
                <RefreshCw className="w-3 h-3" />
                Update
              </button>
            )}
          </div>

          {/* Display current filter status */}
          {activeSBUFilter && (
            <div className="mb-4 p-3 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-400/30 rounded-lg backdrop-blur-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-blue-100">
                  Active Filter: {activeSBUFilter.toUpperCase()}
                </div>
                <button
                  onClick={() => handleSBUClick('')}
                  className="text-xs px-2 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 rounded text-red-200 hover:text-red-100 transition-all duration-200"
                  title="Clear SBU Filter"
                >
                  Clear
                </button>
              </div>
              <div className="text-xs text-blue-200">
                Total Locations: {filteredLocations.length}
              </div>
              <div className="text-xs text-blue-300 mt-1">
                Companies: {Object.keys(companyCounts).length} |
                Zones: {Object.keys(zoneCounts).length} |
                States: {Object.keys(stateCounts).length}
              </div>
              {/* Show date filter status for LPG */}
              {isLPGSelected() && (selectedFromDate || selectedToDate) && (
                <div className="text-xs text-purple-200 mt-1">
                  Date Filter: {selectedFromDate && `From ${new Date(selectedFromDate).toLocaleDateString()}`}
                  {selectedFromDate && selectedToDate && ' | '}
                  {selectedToDate && `To ${new Date(selectedToDate).toLocaleDateString()}`}
                </div>
              )}
            </div>
          )}

          {/* Show LPG date picker status when LPG is not selected */}
          {!isLPGSelected() && activeSBUFilter && (
            <div className="mb-4 p-3 bg-yellow-600/20 border border-yellow-400/30 rounded-lg backdrop-blur-sm">
              <div className="text-xs text-yellow-200">
                📅 Date filtering is only available for LPG SBU
              </div>
            </div>
          )}

          {/* Map Info Display with Zoom Level */}
           
            {activeSBUFilter && (
              <div className="text-xs text-blue-300 mt-1">
                Filtered by: {activeSBUFilter.toUpperCase()}
              </div>
            )}
         

          <CompanyCountSidebar
            companyCounts={companyCounts}
            totalCount={totalCount}
            colorMapping={colorMapping}
            handleUpdateClick={handleUpdateClick}
          />

          <PieChartSection
            getChartTitle={getChartTitle}
            canGoBack={canGoBack}
            goToPreviousLevel={goToPreviousLevel}
            resetPieChart={resetPieChart}
            currentCounts={currentCounts}
            pieChartRef={pieChartRef}
          />
        </div>
      </div>

      {showFilteredTable && isSBUSelected() && (
        <FilteredTable
          displayData={displayData}
          filteredData={filteredData}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          handleSort={handleSort}
          getSortIcon={getSortIcon}
        />
      )}

      <UpdateDataTable
        showUpdateDialog={showUpdateDialog}
        setShowUpdateDialog={setShowUpdateDialog}
        filteredUpdateData={filteredUpdateData}
        updateTableData={updateTableData}
        setUpdateTableData={setUpdateTableData}
        updateSearchTerm={updateSearchTerm}
        setUpdateSearchTerm={setUpdateSearchTerm}
        isLoadingUpdate={isLoadingUpdate}
        editingRowId={editingRowId}
        setEditingRowId={setEditingRowId}
        editedRow={editedRow}
        setEditedRow={setEditedRow}
        handleEditClick={handleEditClick}
        handleEditInputChange={handleEditInputChange}
        handleSaveEdit={handleSaveEdit}
        handleCancelEdit={handleCancelEdit}
        handleBulkDelete={handleBulkDelete}
        handleAddNewRecord={function (): void {
          throw new Error('Function not implemented.');
        }}
        handleRefresh={fetchUpdateData}
        selectedSbu={selectedsbu}
        dataType={getDataTypeFromSbu(getSelectedValue(selectedFilters.sbu))}
      />

      <UploadDialog
        showUploadDialog={showUploadDialog}
        setShowUploadDialog={setShowUploadDialog}
        uploadStatus={uploadStatus}
        resetUploadStatus={resetUploadStatus}
        canUpload={canUpload}
        handleFileSelect={handleFileSelect}
        fileInputRef={fileInputRef}
        selectedSbu={getSelectedValue(selectedFilters.sbu)}
      />

      <LocationDialog
        selectedLocation={selectedLocation}
        onClose={() => setSelectedLocation(null)}
      />
    </div>
  );
};

export default IndiaMap;