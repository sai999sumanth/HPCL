import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RefreshCw, Layers, Plus, Minus } from 'lucide-react';
import { apiClient } from '../../../../services/apiClient';
import LocationDialogue from './LocationDialogue';

// Declare Google Maps types
declare global {
  interface Window {
    google: any;
  }
}

// Google Maps API Key
const GOOGLE_MAPS_API_KEY = 'AIzaSyDfMVbeSC78K1l78ZCsccs0WENDG6brfVc';
const GOOGLE_MAP_ID = (import.meta as any)?.env?.VITE_GOOGLE_MAP_ID || '';
const GOOGLE_MAPS_API_URL = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&v=weekly&region=IN&libraries=drawing,geometry,marker&loading=async`;

// Default map view settings (India fully visible)
// Center adjusted slightly south to show more of northern regions (map head)
const DEFAULT_MAP_CENTER = { lat: 20.0, lng: 79.0 };
const DEFAULT_MAP_ZOOM = 4.9;

interface IndiaMapProps {
  filters?: {
    sbu?: string | '';
    company?: string[];
    zone?: string | '';
    state?: string | '';
    district?: string | '';
    location_name?: string | '';
  };
}

const IndiaMap: React.FC<IndiaMapProps> = ({ filters = {
  sbu: '',
  company: [],
  zone: '',
  state: '',
  district: '',
  location_name: ''
} }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapStyle, setMapStyle] = useState<'satellite' | 'vector'>('vector');
  const [locationData, setLocationData] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<any | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isClearingFilters, setIsClearingFilters] = useState(false);
  const scriptLoadedRef = useRef<boolean>(false);
  const mapInitRetryRef = useRef<number>(0);
  const isAnimatingRef = useRef<boolean>(false);
  const previousFiltersRef = useRef<string>('');

  // Load Google Maps API script dynamically
  useEffect(() => {
    if (window.google && window.google.maps) {
      setMapLoaded(true);
      return;
    }

    if (scriptLoadedRef.current) {
      return;
    }

    const existingScript = Array.from(document.querySelectorAll('script')).find((s) =>
      (s as HTMLScriptElement).src?.startsWith(`https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`)
    );
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        setMapLoaded(true);
      });
      return;
    }

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
      scriptLoadedRef.current = false;
    };
  }, []);

  // Convert filter format from FilterSidebar to API format
  const buildApiFilters = useCallback((filterData: any) => {
    const apiFilters: any[] = [];

    if (!filterData) return apiFilters;

    if (filterData?.sbu && filterData.sbu !== '') {
      apiFilters.push({
        key: 'sbu',
        cond: 'in',
        value: filterData.sbu,
        val: filterData.sbu
      });
    }

    if (filterData?.company && Array.isArray(filterData.company) && filterData.company.length > 0) {
      // Join multiple companies with comma for single filter object
      const companyValue = filterData.company.join(',');
      apiFilters.push({
        key: 'company',
        cond: 'in',
        value: companyValue,
        val: companyValue
      });
    }

    if (filterData?.zone && filterData.zone !== '') {
      apiFilters.push({
        key: 'zone',
        cond: 'in',
        value: filterData.zone,
        val: filterData.zone
      });
    }

    if (filterData?.state && filterData.state !== '') {
      apiFilters.push({
        key: 'state',
        cond: 'in',
        value: filterData.state,
        val: filterData.state
      });
    }

    if (filterData?.district && filterData.district !== '') {
      apiFilters.push({
        key: 'district',
        cond: 'in',
        value: filterData.district,
        val: filterData.district
      });
    }

    if (filterData?.location_name && filterData.location_name !== '') {
      apiFilters.push({
        key: 'location_name',
        cond: 'in',
        value: filterData.location_name,
        val: filterData.location_name
      });
    }

    return apiFilters;
  }, []);

  // Fetch location data from API
  const fetchLocationData = useCallback(async () => {
    try {
      const apiFilters = buildApiFilters(filters);
      
      const payload = {
        filters: apiFilters,
        drill_state: "",
        cross_filters: [],
        limit: 0,
        time_grain: ""
      };

      console.log('IndiaMap - API Payload:', payload);

      const response = await apiClient.post('/api/sodinfra/get_all_sod_lpg_infra', payload);
      const data = response.data?.data || response.data || [];
      setLocationData(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching location data:', error);
      setLocationData([]);
    }
  }, [filters, buildApiFilters]);

  // Determine zoom level based on filter hierarchy
  const getZoomLevel = useCallback((filters: any) => {
    // Hierarchical zoom levels based on filter selection:
    // location_name > district > state > zone > company/sbu
    if (filters?.location_name && filters.location_name !== '') {
      return 19; // Very detailed zoom - shows individual buildings (like location image)
    } else if (filters?.district && filters.district !== '') {
      return 11; // District level - shows district area
    } else if (filters?.state && filters.state !== '') {
      return 8; // State level - shows entire state
    } else if (filters?.zone && filters.zone !== '') {
      return 6; // Zone level - shows multiple states (like South India view)
    } else if ((filters?.company && filters.company.length > 0) || (filters?.sbu && filters.sbu !== '')) {
      return 5; // Company/SBU level - broad view
    }
    return DEFAULT_MAP_ZOOM; // Default India view
  }, []);

  // Smooth zoom animation to target level (simplified for reliability)
  const animateZoom = useCallback((map: any, targetZoom: number, center: any) => {
    if (!map) {
      console.error('animateZoom: map is null');
      return;
    }
    
    const currentZoom = map.getZoom();
    const zoomDiff = targetZoom - currentZoom;
    
    console.log('animateZoom called:', { currentZoom, targetZoom, zoomDiff, center });
    
    // Use Google Maps built-in smooth pan and zoom
    // Pan to center first (this is smooth by default)
    map.panTo(center);
    
    // Then zoom to target (Google Maps handles smooth transition)
    setTimeout(() => {
      console.log('Setting zoom to:', targetZoom);
      map.setZoom(targetZoom);
    }, 500);
  }, []);

  // Check if filters are cleared (all empty/default)
  const areFiltersCleared = useCallback((filters: any) => {
    return (
      (!filters?.sbu || filters.sbu === '') &&
      (!filters?.company || (Array.isArray(filters.company) && filters.company.length === 0)) &&
      (!filters?.zone || filters.zone === '') &&
      (!filters?.state || filters.state === '') &&
      (!filters?.district || filters.district === '') &&
      (!filters?.location_name || filters.location_name === '')
    );
  }, []);

  // Smooth animation back to default view (optimized to prevent hanging)
  const animateToDefault = useCallback((map: any, showLoading = false) => {
    if (!map || isAnimatingRef.current) return;
    
    isAnimatingRef.current = true;
    
    // Show loading animation if requested
    if (showLoading) {
      setIsClearingFilters(true);
    }
    
    // Cancel any ongoing animations by checking if map is ready
    const currentZoom = map.getZoom();
    const targetZoom = DEFAULT_MAP_ZOOM;
    
    // If already at target, just ensure center is correct
    if (Math.abs(currentZoom - targetZoom) < 0.5) {
      // Use fitBounds with padding to show more of northern regions
      const google = window.google;
      if (google && google.maps) {
        const bounds = new google.maps.LatLngBounds(
          { lat: 6, lng: 68 },
          { lat: 37, lng: 98 }
        );
        map.fitBounds(bounds, {
          padding: { top: 50, right: 50, bottom: 50, left: 50 }
        });
      } else {
        map.panTo(DEFAULT_MAP_CENTER);
      }
      isAnimatingRef.current = false;
      if (showLoading) {
        setTimeout(() => setIsClearingFilters(false), 500);
      }
      return;
    }
    
    // Use fitBounds to show India with padding that favors showing more north
    const google = window.google;
    if (google && google.maps) {
      const bounds = new google.maps.LatLngBounds(
        { lat: 6, lng: 68 },
        { lat: 37, lng: 98 }
      );
      map.fitBounds(bounds, {
        padding: { top: 50, right: 50, bottom: 50, left: 50 }
      });
    } else {
      map.panTo(DEFAULT_MAP_CENTER);
      setTimeout(() => {
        map.setZoom(targetZoom);
      }, 400);
    }
    
    // Reset animation flag after animation completes
    setTimeout(() => {
      isAnimatingRef.current = false;
      if (showLoading) {
        setIsClearingFilters(false);
      }
    }, 1000);
  }, []);

  // Zoom to fit all markers with hierarchical animation
  const zoomToMarkers = useCallback((map: any, google: any, filters?: any, locationData?: any[]) => {
    if (!map || !google || !google.maps) {
      return;
    }

    // Check if filters are cleared
    const filtersCleared = areFiltersCleared(filters || {});
    
    // If filters are cleared, animate back to default view with loading animation
    if (filtersCleared) {
      animateToDefault(map, true);
      return;
    }

    // If filters are applied but no markers yet, try to use locationData directly
    if (markersRef.current.length === 0) {
      // If we have locationData, we can still zoom to it
      if (locationData && locationData.length > 0) {
        // Use locationData to zoom (will be handled below)
        console.log('No markers yet, but have locationData, proceeding with zoom');
      } else {
        // No data at all, go to default
        animateToDefault(map);
        return;
      }
    }

    // Collect all valid positions with validation
    const positions: any[] = [];
    
    // First try to get positions from markers
    markersRef.current.forEach((marker) => {
      let position = null;
      
      // Try different ways to get position based on marker type
      if (marker.position) {
        position = marker.position;
      } else if (marker.getPosition) {
        position = marker.getPosition();
      } else if (marker.latLng) {
        position = marker.latLng;
      }
      
      // Validate position has valid coordinates
      if (position) {
        const lat = position.lat || position.latitude;
        const lng = position.lng || position.longitude;
        
        // Only add if coordinates are valid numbers
        if (lat != null && lng != null && 
            !isNaN(Number(lat)) && !isNaN(Number(lng)) &&
            isFinite(Number(lat)) && isFinite(Number(lng))) {
          positions.push(position);
        }
      }
    });

    // If no positions from markers but we have locationData, use locationData directly
    if (positions.length === 0 && locationData && locationData.length > 0) {
      locationData.forEach((loc: any) => {
        if (loc.latitude && loc.longitude) {
          const lat = parseFloat(loc.latitude);
          const lng = parseFloat(loc.longitude);
          if (!isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng)) {
            positions.push({ lat, lng });
          }
        } else if (loc.lat && loc.lng) {
          const lat = parseFloat(loc.lat);
          const lng = parseFloat(loc.lng);
          if (!isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng)) {
            positions.push({ lat, lng });
          }
        }
      });
    }

    if (positions.length === 0) {
      console.warn('No valid positions found for zooming');
      return;
    }

    // Calculate center point of all markers with validation
    let centerLat = 0;
    let centerLng = 0;
    let validCount = 0;
    
    positions.forEach((pos) => {
      const lat = pos.lat || pos.latitude;
      const lng = pos.lng || pos.longitude;
      
      if (lat != null && lng != null && 
          !isNaN(Number(lat)) && !isNaN(Number(lng)) &&
          isFinite(Number(lat)) && isFinite(Number(lng))) {
        centerLat += Number(lat);
        centerLng += Number(lng);
        validCount++;
      }
    });
    
    if (validCount === 0) return;
    
    centerLat /= validCount;
    centerLng /= validCount;
    
    // Validate center coordinates before creating LatLng
    if (isNaN(centerLat) || isNaN(centerLng) || !isFinite(centerLat) || !isFinite(centerLng)) {
      console.error('Invalid center coordinates calculated:', centerLat, centerLng);
      return;
    }
    
    const center = new google.maps.LatLng(centerLat, centerLng);

    // Get target zoom level based on filter hierarchy
    const targetZoom = getZoomLevel(filters || {});
    console.log('zoomToMarkers - targetZoom:', targetZoom, 'positions:', positions.length, 'filters:', filters);

    // If location_name is selected, find and zoom to that specific location
    if (filters?.location_name && filters.location_name !== '' && locationData && locationData.length > 0) {
      // Normalize the filter location name (trim and lowercase)
      const filterLocationName = filters.location_name.trim().toLowerCase();
      
      // If only one location in filtered data, use it directly
      let selectedLocation = null;
      
      if (locationData.length === 1) {
        selectedLocation = locationData[0];
        console.log('Single location in filtered data, using it directly:', selectedLocation);
      } else {
        // Find the specific location in locationData with improved matching
        selectedLocation = locationData.find((loc: any) => {
        if (!loc) return false;
        
        // Check location_name field
        if (loc.location_name) {
          const locName = String(loc.location_name).trim().toLowerCase();
          if (locName === filterLocationName || locName.includes(filterLocationName) || filterLocationName.includes(locName)) {
            return true;
          }
        }
        
        // Check name field
        if (loc.name) {
          const locName = String(loc.name).trim().toLowerCase();
          if (locName === filterLocationName || locName.includes(filterLocationName) || filterLocationName.includes(locName)) {
            return true;
          }
        }
        
        return false;
        });
      }

      if (selectedLocation) {
        console.log('Found location for zoom:', selectedLocation);
        
        // Try latitude/longitude fields (various possible field names)
        let lat = null;
        let lng = null;
        
        if (selectedLocation.latitude && selectedLocation.longitude) {
          lat = parseFloat(selectedLocation.latitude);
          lng = parseFloat(selectedLocation.longitude);
        } else if (selectedLocation.lat && selectedLocation.lng) {
          lat = parseFloat(selectedLocation.lat);
          lng = parseFloat(selectedLocation.lng);
        } else if (selectedLocation.Latitude && selectedLocation.Longitude) {
          lat = parseFloat(selectedLocation.Latitude);
          lng = parseFloat(selectedLocation.Longitude);
        }
        
        // Validate coordinates are valid finite numbers
        if (lat !== null && lng !== null && 
            !isNaN(lat) && !isNaN(lng) && 
            isFinite(lat) && isFinite(lng) && 
            lat !== 0 && lng !== 0 &&
            lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          console.log('Zooming to location coordinates:', lat, lng, 'zoom level:', targetZoom);
          const locationPosition = new google.maps.LatLng(lat, lng);
          
          // Direct zoom - pan and zoom immediately
          map.panTo(locationPosition);
          setTimeout(() => {
            map.setZoom(targetZoom);
            console.log('Zoom completed to:', targetZoom);
          }, 300);
          return;
        } else {
          console.warn('Location found but invalid coordinates:', selectedLocation, 'lat:', lat, 'lng:', lng);
        }
      } else {
        const filterLocationName = filters.location_name.trim().toLowerCase();
        console.warn('Location not found in data:', filterLocationName, 'Available locations:', locationData.map((l: any) => l.location_name || l.name).slice(0, 10));
      }
    }

    if (positions.length === 1) {
      // Single marker - zoom to hierarchical level
      const position = positions[0];
      const lat = position.lat || position.latitude;
      const lng = position.lng || position.longitude;
      
      // Validate coordinates before using
      if (lat != null && lng != null && 
          !isNaN(Number(lat)) && !isNaN(Number(lng)) &&
          isFinite(Number(lat)) && isFinite(Number(lng))) {
        console.log('Zooming to single position:', lat, lng, 'zoom level:', targetZoom);
        // Direct zoom
        map.panTo(position);
        setTimeout(() => {
          map.setZoom(targetZoom);
          console.log('Single position zoom completed to:', targetZoom);
        }, 300);
      } else {
        console.error('Invalid position coordinates:', position);
      }
      return;
    }

    // Multiple markers - fit bounds first, then adjust to target zoom
    const bounds = new google.maps.LatLngBounds();
    
    positions.forEach((position) => {
      if (position) {
        const lat = position.lat || position.latitude;
        const lng = position.lng || position.longitude;
        
        // Validate coordinates before extending bounds
        if (lat != null && lng != null && 
            !isNaN(Number(lat)) && !isNaN(Number(lng)) &&
            isFinite(Number(lat)) && isFinite(Number(lng))) {
          bounds.extend(position);
        }
      }
    });

    if (!bounds.isEmpty()) {
      // First fit bounds to show all markers
      map.fitBounds(bounds, {
        padding: { top: 100, right: 100, bottom: 100, left: 100 }
      });

      // Then adjust zoom to match filter hierarchy level
      setTimeout(() => {
        const currentZoom = map.getZoom();
        if (currentZoom && Math.abs(currentZoom - targetZoom) > 1) {
          // If current zoom is significantly different from target, animate to target
          animateZoom(map, targetZoom, center);
        }
      }, 800);
    }
  }, [getZoomLevel, animateZoom, areFiltersCleared, animateToDefault]);

  // Add markers to map based on location data
  const addMarkersToMap = useCallback((map: any, google: any, filters?: any) => {
    // Clear existing markers
    markersRef.current.forEach(marker => {
      if (marker.setMap) {
        marker.setMap(null);
      } else if (marker.map) {
        marker.map = null;
      }
    });
    markersRef.current = [];

    if (!locationData || locationData.length === 0) {
      // No data - zoomToMarkers will handle animation back to default
      setTimeout(() => {
        zoomToMarkers(map, google, filters, locationData);
      }, 100);
      return;
    }

    // Advanced Markers require a valid Map ID
    // Check if GOOGLE_MAP_ID is set and if AdvancedMarkerElement is available
    const hasValidMapId = GOOGLE_MAP_ID && GOOGLE_MAP_ID !== '';
    const canUseAdvancedMarkers = hasValidMapId && 
                                   google.maps.marker && 
                                   google.maps.marker.AdvancedMarkerElement;

    locationData.forEach((location) => {
      if (!location.latitude || !location.longitude || 
          isNaN(parseFloat(location.latitude)) || 
          isNaN(parseFloat(location.longitude))) {
        return;
      }

      try {
        const lat = parseFloat(location.latitude);
        const lng = parseFloat(location.longitude);
        
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

        if (canUseAdvancedMarkers) {
          // Create custom pin element using AdvancedMarkerElement PinElement
          const pinElement = new google.maps.marker.PinElement({
            background: markerColor,
            borderColor: '#ffffff',
            glyphColor: '#ffffff',
            scale: 1.0,
          });

          // Create AdvancedMarkerElement (replaces deprecated Marker)
          marker = new google.maps.marker.AdvancedMarkerElement({
            map: map,
            position: { lat, lng },
            title: location.location_name || location.name || 'Location',
            content: pinElement.element,
          });
        } else {
          // Fallback to legacy Marker API with custom pin icon
          // Create a custom pin shape using SVG path
          const pinPath = 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z';
          
          const svgIcon = {
            path: pinPath,
            fillColor: markerColor,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 1.2,
            anchor: new google.maps.Point(12, 24),
          };

          marker = new google.maps.Marker({
            position: { lat, lng },
            map: map,
            title: location.location_name || location.name || 'Location',
            icon: svgIcon,
            optimized: true,
          });
        }

        // Add click listener to open location dialog
        marker.addListener('click', () => {
          setSelectedLocation(location);
          setIsDialogOpen(true);
        });

        markersRef.current.push(marker);
      } catch (error) {
        console.error('Error adding marker:', error, location);
      }
    });

    // Zoom to fit all markers after adding them with hierarchical animation
    // Use setTimeout to ensure markers are fully rendered
    setTimeout(() => {
      zoomToMarkers(map, google, filters, locationData);
    }, 200);
    // Only re-run when locationData or filters actually change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationData, filters]);

  // Load GeoJSON borders for Google Maps with black outline
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
            strokeColor: '#000000', // Black outline
            strokeWeight: 2,
            fillOpacity: 0,
          });

          console.log('✅ India border loaded successfully');
          break;
        }
      } catch (error) {
        console.log(`⚠️ Failed to load from ${url}, trying next...`);
      }
    }
  }, []);

  // Toggle map type between Satellite and Roadmap
  const toggleMapType = useCallback(() => {
    setMapStyle((prev) => {
      const newType = prev === 'satellite' ? 'vector' : 'satellite';
      return newType;
    });
  }, []);

  // Reset map to default view (India fully visible)
  const resetMapView = useCallback(() => {
    const map = mapInstanceRef.current;
    if (map) {
      map.setCenter(DEFAULT_MAP_CENTER);
      map.setZoom(DEFAULT_MAP_ZOOM);
    }
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
      const newZoom = currentZoom - 1;
      
      // If zooming out below default zoom, reset to default view
      if (newZoom < DEFAULT_MAP_ZOOM) {
        resetMapView();
      } else {
        map.setZoom(newZoom);
      }
    }
  }, [resetMapView]);

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
          setTimeout(attemptInit, 200);
        } else {
          console.error('❌ Google Maps library not ready');
        }
        return;
      }

      try {
        // Create map centered on India
        const map = new google.maps.Map(mapContainerRef.current, {
          center: DEFAULT_MAP_CENTER,
          zoom: DEFAULT_MAP_ZOOM,
          mapTypeId: mapStyle === 'satellite' ? 'hybrid' : 'roadmap',
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: false, // Disable default zoom control, using custom
          gestureHandling: 'greedy',
          minZoom: 4,
          maxZoom: 20,
          mapId: GOOGLE_MAP_ID || undefined,
          restriction: {
            latLngBounds: {
              north: 37,
              south: 6,
              west: 68,
              east: 98,
            },
            strictBounds: false,
          },
        });

        mapInstanceRef.current = map;
        mapInitRetryRef.current = 0;

        google.maps.event.addListener(map, 'tilesloaded', () => {
          console.log('✅ Google Maps tiles loaded successfully');
        });

        // Add zoom change listener to auto-reset if zoomed out too far
        google.maps.event.addListener(map, 'zoom_changed', () => {
          const currentZoom = map.getZoom();
          // If zoom goes below default zoom, reset to default view
          if (currentZoom < DEFAULT_MAP_ZOOM) {
            setTimeout(() => {
              map.setCenter(DEFAULT_MAP_CENTER);
              map.setZoom(DEFAULT_MAP_ZOOM);
            }, 100);
          }
        });

        // Load GeoJSON borders with black outline (only once)
        loadGeoJSONBorders(map, google);

        // Fetch initial location data (only once on map initialization)
        // Don't fetch here - let the filters useEffect handle it
        fetchLocationData();

        console.log('✅ Map initialized successfully with Google Maps');
      } catch (error) {
        console.error('❌ Error initializing Google Maps:', error);
      }
    };

    attemptInit();
    // Only depend on mapLoaded - map should only initialize once
    // mapStyle changes are handled by separate useEffect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded]);

  // Fetch location data when filters change (after map is initialized)
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;
    
    // Create a string representation of filters to compare
    const filtersKey = JSON.stringify(filters);
    
    // Only fetch if filters actually changed
    if (previousFiltersRef.current === filtersKey) {
      console.log('Filters unchanged, skipping API call');
      return;
    }
    
    previousFiltersRef.current = filtersKey;
    
    // Fetch new data when filters change
    const apiFilters = buildApiFilters(filters);
    
    const payload = {
      filters: apiFilters,
      drill_state: "",
      cross_filters: [],
      limit: 0,
      time_grain: ""
    };

    console.log('IndiaMap - API Payload (filter change):', payload);

    apiClient.post('/api/sodinfra/get_all_sod_lpg_infra', payload)
      .then((response) => {
        const data = response.data?.data || response.data || [];
        setLocationData(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        console.error('Error fetching location data:', error);
        setLocationData([]);
      });
  }, [filters, mapLoaded, buildApiFilters]);

  // Add markers when location data or map is ready
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;
    
    const map = mapInstanceRef.current;
    const google = window.google;
    
    if (google && google.maps) {
      addMarkersToMap(map, google, filters);
    }
  }, [mapLoaded, locationData, addMarkersToMap, filters]);

  // Change map type when mapStyle changes
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const google = window.google;

    if (mapStyle === 'satellite') {
      map.setMapTypeId(google.maps.MapTypeId.HYBRID);
    } else {
      map.setMapTypeId(google.maps.MapTypeId.ROADMAP);
    }
  }, [mapStyle, mapLoaded]);

  return (
    <div className="h-full relative overflow-hidden">
          {/* Google Map Container */}
      <div ref={mapContainerRef} id="google-map-container" className="w-full h-full" />
          
          {/* Hide Google Maps bottom links and adjust map top position */}
          <style>{`
            #google-map-container .gm-style {
              transform: translateY(15px) !important;
            }
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

          {/* Loading indicator for map initialization */}
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

          {/* Loading animation when clearing filters */}
          {isClearingFilters && mapLoaded &&  (
            <div className="absolute inset-0 flex items-center justify-center z-30 bg-white/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-lg shadow-xl">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1.4s' }}></div>
                  <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1.4s' }}></div>
                  <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1.4s' }}></div>
                </div>
                <span className="text-gray-700 font-medium text-sm">Resetting map view...</span>
              </div>
            </div>
          )}

      {/* Map Controls - Top Left (Layer Toggle + Zoom) */}
          {mapLoaded && (
        <div className="absolute top-4 left-4 z-30 flex flex-col gap-1 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
          {/* Layer Toggle Button */}
            <button
              onClick={toggleMapType}
            className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition-colors"
              title={mapStyle === 'satellite' ? 'Switch to Roadmap' : 'Switch to Satellite View'}
            >
            <Layers className="w-5 h-5 text-gray-700" />
            </button>
          
          {/* Zoom In Button */}
              <button
            onClick={handleZoomIn}
            className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition-colors border-t border-gray-200"
            title="Zoom In"
          >
            <Plus className="w-5 h-5 text-gray-700" />
              </button>
          
          {/* Zoom Out Button */}
                <button
            onClick={handleZoomOut}
            className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition-colors border-t border-gray-200"
            title="Zoom Out"
          >
            <Minus className="w-5 h-5 text-gray-700" />
                </button>
                </div>
              )}

          {/* Location Dialogue */}
          <LocationDialogue
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            location={selectedLocation}
            mapStyle={mapStyle}
          />
    </div>
  );
};

export default IndiaMap;