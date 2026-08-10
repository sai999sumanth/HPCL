import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/services/apiClient';
import { toast } from 'sonner';
import { Loader2, ArrowUp, Gauge, Download } from 'lucide-react';
import PipelineDetailsPanel from './PipelineDetailsPanel';
import dispatchImage from '@/assets/images/dispatch-terminal.svg';
import dispatchPngImage from '@/assets/images/dispatch.png';
import intermediatePumpingImage from '@/assets/images/intermediate-pumping.png';
import receivingTerminalImage from '@/assets/images/latch_7426516.png';

// Declare Google Maps types
declare global {
  interface Window {
    google: any;
  }
}

// Google Maps API Key - Conditional based on environment
const isLocalhost = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '[::1]'
);

const GOOGLE_MAPS_API_KEY = isLocalhost 
  ? 'AIzaSyDorRi84rv4PXvtlfR0-njm0LqRAkE1vHE'  // For localhost
  : 'AIzaSyDfMVbeSC78K1l78ZCsccs0WENDG6brfVc'; // For others

const GOOGLE_MAPS_API_URL = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&v=weekly&region=IN&libraries=drawing,geometry,marker&loading=async`;

// Types
interface Coordinates {
  latitude: number;
  longitude: number;
}

interface Location {
  location_code: string;
  location_name: string;
  location_type: 'DISPATCH_TERMINAL' | 'INTERMEDIATE_PUMPING' | 'RECEIVING_TERMINAL';
  state: string;
  coordinates: Coordinates;
}

interface BranchLine {
  to_station: string;
  to_station_code: string;
  from_point: {
    longitude: number;
    latitude: number;
  };
  geometry: {
    type: 'LineString';
    coordinates: number[][];
  };
  length_km: number;
  branch_type: string;
  is_endpoint?: boolean;
}

interface Pipeline {
  name: string;
  description: string;
  pipeline_color?: string; // Hexadecimal color for pipeline
  pipeline_type: string;
  total_length_km: number;
  capacity: {
    value: number;
    unit: string;
  };
  products: string[];
  states_spanned: string[];
  phases: any[];
  locations: Location[];
  sv_stations: {
    count: number;
    avg_spacing_km: number;
  };
  line_fill_quantity_kl?: number;
  pipe_size_inch?: string;
  url: string;
  main_route: {
    type: 'LineString';
    coordinates: number[][];
  };
  branch_lines: BranchLine[];
  map_visualization: {
    has_branches: boolean;
    branch_count: number;
    main_route_length: number;
  };
}

interface ApiResponse {
  status: boolean;
  message: string;
  data: Pipeline[];
}

interface SelectedLocation {
  location: Location;
  pipeline: Pipeline;
}

// Helper function to create location icon (moved inside component to access state)
const createLocationIconFactory = (iconDataUrls: any) => {
  return (locationType: string, googleMaps?: any, zoomLevel?: number): any => {
    // Dynamic icon size and type based on zoom level
    // Small simple icons at low zoom, full icons with images at high zoom
    let iconSize = 16; // Default small size for initial load/low zoom
    let showFullIcon = false; // Whether to show full icon with image
    
    if (zoomLevel) {
      if (zoomLevel <= 5) {
        iconSize = 16; // Very small icons at low zoom - simple circles
        showFullIcon = false;
      } else if (zoomLevel <= 6) {
        iconSize = 20; // Small icons
        showFullIcon = false;
      } else if (zoomLevel <= 7) {
        iconSize = 28; // Medium icons - start showing images
        showFullIcon = true;
      } else {
        iconSize = 40; // Large icons when zoomed in - full icons with images
        showFullIcon = true;
      }
    }
    
    let anchor, scaledSize;
    
    if (googleMaps && googleMaps.maps && googleMaps.maps.Point && googleMaps.maps.Size) {
      anchor = new googleMaps.maps.Point(iconSize / 2, iconSize / 2);
      scaledSize = new googleMaps.maps.Size(iconSize, iconSize);
    }
    
    // Determine colors based on location type
    let bgColor = '#6B7280'; // Default grey
    let borderColor = '#4B5563'; // Dark grey border
    let imageUrl = '';
    
    // Get colors and image based on location type
    if (locationType === 'DISPATCH_TERMINAL') {
      bgColor = '#10B981'; // Emerald green
      borderColor = '#059669'; // Darker green border
      imageUrl = iconDataUrls?.dispatch || dispatchImage;
    } else if (locationType === 'RECEIVING_TERMINAL') {
      bgColor = '#3B82F6'; // Blue
      borderColor = '#2563EB'; // Darker blue border
      imageUrl = iconDataUrls?.receiving || receivingTerminalImage;
    } else if (locationType === 'INTERMEDIATE_PUMPING') {
      bgColor = '#8B5CF6'; // Purple
      borderColor = '#7C3AED'; // Darker purple border
      imageUrl = iconDataUrls?.intermediate || intermediatePumpingImage;
    }
    
    // At low zoom, show simple small circles (no images)
    if (!showFullIcon) {
      const svg = `
        <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <circle cx="10" cy="10" r="${iconSize / 2 - 1}" fill="${bgColor}" stroke="${borderColor}" stroke-width="1.5"/>
        </svg>
      `;
      return {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
        scaledSize: scaledSize,
        anchor: anchor,
      };
    }
    
    // At high zoom, show full icons with images
    const padding = 2; // Padding around image
    const imageSize = iconSize - (padding * 2);
    
    // Use data URL if available, otherwise use original URL
    const svg = `
      <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 ${iconSize} ${iconSize}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <rect x="0" y="0" width="${iconSize}" height="${iconSize}" rx="4" fill="${bgColor}" stroke="${borderColor}" stroke-width="2"/>
        <image x="${padding}" y="${padding}" width="${imageSize}" height="${imageSize}" href="${imageUrl}" preserveAspectRatio="xMidYMid meet"/>
      </svg>
    `;
    
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: scaledSize,
      anchor: anchor,
    };
  };
};

// Function to brighten/make colors more vibrant (for inner fill)
const brightenColor = (color: string): string => {
  if (!color) return '#FFD700'; // Bright yellow default
  
  // Remove # if present
  let cleanColor = color.replace('#', '').trim();
  
  // Handle 3-digit hex colors
  if (cleanColor.length === 3) {
    cleanColor = cleanColor.split('').map(c => c + c).join('');
  }
  
  // Validate hex color
  if (!/^[0-9A-Fa-f]{6}$/.test(cleanColor)) {
    return '#FFD700'; // Bright yellow default
  }
  
  // Convert to RGB
  const r = parseInt(cleanColor.substr(0, 2), 16);
  const g = parseInt(cleanColor.substr(2, 2), 16);
  const b = parseInt(cleanColor.substr(4, 2), 16);
  
  // Make very bright and vibrant (for inner fill)
  const brightenFactor = 1.6;
  const newR = Math.min(255, Math.round(r * brightenFactor));
  const newG = Math.min(255, Math.round(g * brightenFactor));
  const newB = Math.min(255, Math.round(b * brightenFactor));
  
  // Convert back to hex
  const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
};

// Function to darken color (for border)
const darkenColor = (color: string): string => {
  if (!color) return '#0066CC'; // Dark blue default
  
  // Remove # if present
  let cleanColor = color.replace('#', '').trim();
  
  // Handle 3-digit hex colors
  if (cleanColor.length === 3) {
    cleanColor = cleanColor.split('').map(c => c + c).join('');
  }
  
  // Validate hex color
  if (!/^[0-9A-Fa-f]{6}$/.test(cleanColor)) {
    return '#0066CC'; // Dark blue default
  }
  
  // Convert to RGB
  const r = parseInt(cleanColor.substr(0, 2), 16);
  const g = parseInt(cleanColor.substr(2, 2), 16);
  const b = parseInt(cleanColor.substr(4, 2), 16);
  
  // Darken for border (reduce intensity)
  const darkenFactor = 0.5;
  const newR = Math.max(0, Math.round(r * darkenFactor));
  const newG = Math.max(0, Math.round(g * darkenFactor));
  const newB = Math.max(0, Math.round(b * darkenFactor));
  
  // Convert back to hex
  const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
};

const PipelineMapView: React.FC = () => {
  const navigate = useNavigate();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentZoom, setCurrentZoom] = useState<number>(5);
  const [mapStyle, setMapStyle] = useState<'satellite' | 'roadmap'>('roadmap');
  const [activeLocationTypeFilter, setActiveLocationTypeFilter] = useState<string>('');
  const [iconDataUrls, setIconDataUrls] = useState<{
    dispatch?: string;
    intermediate?: string;
    receiving?: string;
  }>({});
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylinesRef = useRef<any[]>([]);
  const animatedPolylinesRef = useRef<any[]>([]);
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const infoWindowRef = useRef<any>(null);
  const pipelineInfoWindowRef = useRef<any>(null);
  const locationInfoWindowRef = useRef<any>(null);
  const pipelineNameLabelsRef = useRef<any[]>([]);
  const pipelineNameLinesRef = useRef<any[]>([]); // For dotted lines connecting labels to pipelines
  const pipelineInfoDataRef = useRef<{
    closestPoint: { lat: number; lng: number };
    clickedPoint: { lat: number; lng: number };
    pipeline: Pipeline;
  } | null>(null); // Store pipeline info data for zoom updates

  // Convert images to data URLs for use in SVG
  useEffect(() => {
    const convertImageToDataUrl = (imageSrc: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              resolve(canvas.toDataURL('image/png'));
            } else {
              reject(new Error('Could not get canvas context'));
            }
          } catch (error) {
            reject(error);
          }
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageSrc;
      });
    };

    // Convert all images to data URLs
    Promise.all([
      convertImageToDataUrl(dispatchImage).then(url => ({ dispatch: url })).catch(() => ({ dispatch: dispatchImage })),
      convertImageToDataUrl(intermediatePumpingImage).then(url => ({ intermediate: url })).catch(() => ({ intermediate: intermediatePumpingImage })),
      convertImageToDataUrl(receivingTerminalImage).then(url => ({ receiving: url })).catch(() => ({ receiving: receivingTerminalImage })),
    ]).then(results => {
      setIconDataUrls(Object.assign({}, ...results));
    });
  }, []);

  // Load Google Maps API - reuse script if already loaded
  useEffect(() => {
    // Check if script is already loaded
    if (window.google && window.google.maps && window.google.maps.Map && window.google.maps.MapTypeId) {
      setMapLoaded(true);
      return;
    }

    // Check if script is already being loaded or exists
    const existingScript = Array.from(document.querySelectorAll('script')).find((s) =>
      (s as HTMLScriptElement).src?.startsWith(`https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`)
    );
    
    if (existingScript) {
      // Script exists, wait for it to load
      const checkInterval = setInterval(() => {
        if (window.google?.maps?.Map && window.google.maps.MapTypeId) {
          setMapLoaded(true);
          clearInterval(checkInterval);
        }
      }, 100);
      
      existingScript.addEventListener('load', () => {
        const checkReady = setInterval(() => {
          if (window.google?.maps?.Map && window.google.maps.MapTypeId) {
            setMapLoaded(true);
            clearInterval(checkReady);
            clearInterval(checkInterval);
          }
        }, 100);
        
        setTimeout(() => {
          clearInterval(checkReady);
          clearInterval(checkInterval);
        }, 5000);
      });
      
      return () => clearInterval(checkInterval);
    }

    // Create and load script
    const script = document.createElement('script');
    script.src = GOOGLE_MAPS_API_URL;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      // Check for API errors in console or window
      setTimeout(() => {
        // Check if Google Maps loaded but has errors
        if (window.google?.maps) {
          // Wait for all Google Maps objects to be available
          const checkReady = setInterval(() => {
            if (window.google?.maps?.Map && window.google.maps.MapTypeId) {
              setMapLoaded(true);
              clearInterval(checkReady);
            }
          }, 100);
          
          // Timeout after 5 seconds
          setTimeout(() => {
            clearInterval(checkReady);
            if (!window.google?.maps?.Map) {
              setError('Google Maps API failed to initialize. Please check API key restrictions.');
            }
          }, 5000);
        } else {
          // Script loaded but google.maps is not available - likely API key error
          setError('Google Maps API key error. Please add http://localhost:5378/* to allowed referrers in Google Cloud Console.');
        }
      }, 500);
    };
    
    script.onerror = () => {
      console.error('Failed to load Google Maps API');
      setError('Failed to load Google Maps API. Please check your API key and referrer restrictions.');
    };
    
    // Listen for Google Maps API errors
    const originalConsoleError = console.error;
    const errorListener = (event: ErrorEvent) => {
      if (event.message && event.message.includes('RefererNotAllowedMapError')) {
        setError('Google Maps API: Referrer not allowed. Please add http://localhost:5378/* to allowed referrers in Google Cloud Console.');
        window.removeEventListener('error', errorListener);
      }
    };
    window.addEventListener('error', errorListener);
    
    document.head.appendChild(script);
  }, []);

  // Fetch pipeline data
  useEffect(() => {
    const fetchPipelineData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.post<ApiResponse>(
          '/api/locationmaster/get_pipeline_locations',
          {}
        );

        if (response.data?.status && response.data?.data) {
          setPipelines(response.data.data);
          
          // Set first pipeline's first location as default selection
          if (response.data.data.length > 0) {
            const firstPipeline = response.data.data[0];
            if (firstPipeline.locations && firstPipeline.locations.length > 0) {
              setSelectedLocation({
                location: firstPipeline.locations[0],
                pipeline: firstPipeline,
              });
            }
          }
        } else {
          throw new Error(response.data?.message || 'Invalid response format');
        }
      } catch (err: any) {
        console.error('Error fetching pipeline locations:', err);
        const errorMessage =
          err?.response?.data?.message || err?.message || 'Failed to fetch pipeline locations';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchPipelineData();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || pipelines.length === 0) return;

    const initMap = () => {
      try {
        if (!window.google?.maps?.Map) {
          setTimeout(initMap, 100);
          return;
        }

        const google = window.google.maps;
        
        // Ensure MapTypeId is available, wait if not
        if (!google.MapTypeId) {
          setTimeout(initMap, 100);
          return;
        }
        
        // Use string literal for mapTypeId if MapTypeId enum is not available
        const mapTypeId = google.MapTypeId.ROADMAP || 'roadmap';
        const mapTypeControlStyle = google.MapTypeControlStyle?.HORIZONTAL_BAR || 0;
        const controlPosition = google.ControlPosition?.TOP_LEFT || 1;

        // India bounds: north: 37, south: 6, west: 68, east: 98
        const indiaBoundsForMap = {
          north: 37,
          south: 6,
          west: 68,
          east: 98,
        };

        // Map styles to blur/desaturate background for better icon visibility
        const mapStyles = [
          {
            featureType: 'all',
            elementType: 'geometry',
            stylers: [{ saturation: -80 }, { lightness: 20 }]
          },
          {
            featureType: 'all',
            elementType: 'labels',
            stylers: [{ visibility: 'simplified' }, { saturation: -100 }]
          },
          {
            featureType: 'road',
            elementType: 'geometry',
            stylers: [{ saturation: -90 }, { lightness: 30 }]
          },
          {
            featureType: 'water',
            elementType: 'geometry',
            stylers: [{ saturation: -70 }, { lightness: 40 }]
          },
          {
            featureType: 'landscape',
            elementType: 'geometry',
            stylers: [{ saturation: -85 }, { lightness: 25 }]
          }
        ];

        const map = new google.Map(mapRef.current, {
          center: { lat: 21.5, lng: 79.0 }, // Center of India
          zoom: 5, // Default zoom to show full India
          mapTypeId: mapTypeId,
          styles: mapStyles, // Apply blur/desaturation styles
          mapTypeControl: false, // Disable default controls, using custom toggle
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          gestureHandling: 'greedy', // Enable zoom with mouse wheel and pinch gestures
          restriction: {
            latLngBounds: indiaBoundsForMap,
            strictBounds: false, // Allow some panning outside but keep focus on India
          },
          minZoom: 4, // Prevent zooming out too far
          maxZoom: 15, // Allow more zoom in for better detail
        });

      mapInstanceRef.current = map;
      
      // Variable to track if click was on pipeline/marker (shared across handlers)
      let clickHandled = false;
      
      // Close info windows when clicking on map (not on pipeline or marker)
      google.event.addListener(map, 'click', (event: any) => {
        // Reset flag - will be set to true by polyline/marker handlers if they handle the click
        clickHandled = false;
        setTimeout(() => {
          // If no polyline/marker handled the click, close the info windows
          if (!clickHandled) {
            if (pipelineInfoWindowRef.current) {
              pipelineInfoWindowRef.current.close();
              pipelineInfoWindowRef.current = null;
            }
            if (locationInfoWindowRef.current) {
              locationInfoWindowRef.current.close();
              locationInfoWindowRef.current = null;
            }
            // Clear pipeline info data
            pipelineInfoDataRef.current = null;
          }
        }, 150);
      });
      
      // Listen to zoom changes to update icon sizes
      google.event.addListener(map, 'zoom_changed', () => {
        const newZoom = map.getZoom();
        if (newZoom !== undefined && newZoom !== null) {
          setCurrentZoom(newZoom);
          
          // Keep markers visible at all zoom levels (just make them smaller when zoomed out)
          // This allows clicking on locations even when zoomed out
          markersRef.current.forEach((marker) => {
            if (marker && (marker as any).locationType) {
              const locationType = (marker as any).locationType;
              
              // Update icon size based on zoom (smaller at low zoom, larger at high zoom)
              const newIcon = createLocationIcon(locationType, window.google, newZoom);
              marker.setIcon(newIcon);
              
              // Always show markers (but respect filter if active)
              // Check if marker should be visible based on filter
              if (!activeLocationTypeFilter || locationType === activeLocationTypeFilter) {
                marker.setMap(map);
              } else {
                marker.setMap(null);
              }
            }
          });
          
          // Update pipeline name label positions and line lengths based on zoom
          // Move labels much further away when zoomed out for better clarity
          // Recalculate positions to avoid overlaps at new zoom level
          const newBaseOffsetDistance = 0.5; // Significantly increased base distance
          const newZoomFactor = newZoom <= 4 ? 6.0 : newZoom <= 5 ? 4.5 : newZoom <= 6 ? 3.0 : newZoom <= 7 ? 2.0 : 1.0;
          const newBaseOffset = newBaseOffsetDistance * newZoomFactor;
          const newMinLabelDistance = 0.2 * newZoomFactor; // Significantly increased minimum distance
          
          // Recalculate all label positions to avoid overlaps at new zoom
          const updatedLabelPositions: Array<{ index: number; position: { lat: number; lng: number } }> = [];
          
          pipelineNameLabelsRef.current.forEach((labelData: any) => {
            if (labelData && labelData.line && labelData.label && labelData.midPoint) {
              const directions = [
                { angle: 45 }, { angle: 135 }, { angle: 225 }, { angle: 315 },
                { angle: 0 }, { angle: 90 }, { angle: 180 }, { angle: 270 },
              ];
              
              let bestPosition: { lat: number; lng: number } | null = null;
              
              for (const direction of directions) {
                const angleRad = (direction.angle * Math.PI) / 180;
                const candidatePosition = {
                  lat: labelData.midPoint.lat + newBaseOffset * Math.sin(angleRad),
                  lng: labelData.midPoint.lng + newBaseOffset * Math.cos(angleRad),
                };
                
                let hasOverlap = false;
                for (const existing of updatedLabelPositions) {
                  const distance = Math.sqrt(
                    Math.pow(candidatePosition.lat - existing.position.lat, 2) +
                    Math.pow(candidatePosition.lng - existing.position.lng, 2)
                  );
                  if (distance < newMinLabelDistance) {
                    hasOverlap = true;
                    break;
                  }
                }
                
                if (!hasOverlap) {
                  bestPosition = candidatePosition;
                  break;
                }
              }
              
              if (!bestPosition) {
                // Fallback: use default direction with increased distance (much further at low zoom)
                const angleRad = (45 * Math.PI) / 180;
                const fallbackMultiplier = newZoom <= 4 ? 2.5 : newZoom <= 5 ? 2.2 : newZoom <= 6 ? 2.0 : 1.8;
                bestPosition = {
                  lat: labelData.midPoint.lat + newBaseOffset * fallbackMultiplier * Math.sin(angleRad),
                  lng: labelData.midPoint.lng + newBaseOffset * fallbackMultiplier * Math.cos(angleRad),
                };
              }
              
              updatedLabelPositions.push({ index: labelData.pipelineIndex, position: bestPosition });
              
              const newLabelPosition = bestPosition;
              
              // Update polyline path (from label to pipeline, with arrow pointing to pipeline)
              labelData.line.setPath([newLabelPosition, labelData.midPoint]);
              
              // Update line visibility and style based on zoom
              const lineOpacity = newZoom <= 5 ? 0.9 : 0.7;
              const lineWeight = newZoom <= 5 ? 3 : 2;
              labelData.line.setOptions({
                strokeOpacity: lineOpacity,
                strokeWeight: lineWeight,
              });
              
              // Update arrow rotation
              const dx = labelData.midPoint.lng - newLabelPosition.lng;
              const dy = labelData.midPoint.lat - newLabelPosition.lat;
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              
              const icons = labelData.line.getIcons();
              if (icons && icons.length > 1) {
                // Update dotted pattern
                if (icons[0] && icons[0].icon) {
                  icons[0].icon.strokeWeight = lineWeight;
                  icons[0].repeat = newZoom <= 5 ? '10px' : '8px';
                }
                // Update arrowhead
                if (icons[1] && icons[1].icon) {
                  icons[1].icon.rotation = angle;
                  icons[1].icon.scale = newZoom <= 5 ? 5 : 4;
                }
                labelData.line.setIcons(icons);
              }
              
              // Update label position
              labelData.label.setPosition(newLabelPosition);
            }
          });
          
          // Update pipeline info window position based on zoom (move arrow closer/further from pipeline)
          if (pipelineInfoWindowRef.current && pipelineInfoDataRef.current) {
            const infoData = pipelineInfoDataRef.current;
            
            // Calculate new offset distance based on zoom
            let offsetDistance = 0.15;
            if (newZoom <= 4) {
              offsetDistance = 0.25; // Further at very low zoom
            } else if (newZoom <= 5) {
              offsetDistance = 0.20; // Further at low zoom
            } else if (newZoom <= 6) {
              offsetDistance = 0.15; // Medium distance
            } else {
              offsetDistance = 0.10; // Closer at high zoom
            }
            
            // Calculate direction from closest point to clicked point
            const dx = infoData.clickedPoint.lng - infoData.closestPoint.lng;
            const dy = infoData.clickedPoint.lat - infoData.closestPoint.lat;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Normalize direction vector
            const dirX = distance > 0 ? dx / distance : 1;
            const dirY = distance > 0 ? dy / distance : 0;
            
            // Update info window position (closer to pipeline at higher zoom)
            const newInfoWindowPosition = {
              lat: infoData.closestPoint.lat + dirY * offsetDistance,
              lng: infoData.closestPoint.lng + dirX * offsetDistance
            };
            
            pipelineInfoWindowRef.current.setPosition(newInfoWindowPosition);
          }
          
          // Update pipeline stroke weights based on zoom for better visibility
          // Calculate new stroke weights
          let newBorderWeight = 8;
          let newFillWeight = 5;
          
          if (newZoom <= 4) {
            newBorderWeight = 14;
            newFillWeight = 10;
          } else if (newZoom <= 5) {
            newBorderWeight = 12;
            newFillWeight = 8;
          } else if (newZoom <= 6) {
            newBorderWeight = 10;
            newFillWeight = 6;
          }
          
          // Update all pipeline polylines (border and fill pairs)
          // Polylines are stored as pairs: [border, fill, border, fill, ...]
          for (let i = 0; i < polylinesRef.current.length; i += 2) {
            const borderPolyline = polylinesRef.current[i];
            const fillPolyline = polylinesRef.current[i + 1];
            
            if (borderPolyline) {
              borderPolyline.setOptions({ strokeWeight: newBorderWeight });
              
              // Update icon stroke weight for dashed patterns
              const borderIcons = borderPolyline.getIcons();
              if (borderIcons && borderIcons.length > 0 && borderIcons[0].icon) {
                borderIcons[0].icon.strokeWeight = newBorderWeight;
                borderIcons[0].repeat = newZoom <= 5 ? '16px' : '12px';
                borderPolyline.setIcons(borderIcons);
              }
            }
            
            if (fillPolyline) {
              fillPolyline.setOptions({ strokeWeight: newFillWeight });
              
              // Update icon stroke weight for dashed patterns
              const fillIcons = fillPolyline.getIcons();
              if (fillIcons && fillIcons.length > 0 && fillIcons[0].icon) {
                fillIcons[0].icon.strokeWeight = newFillWeight;
                fillIcons[0].repeat = newZoom <= 5 ? '16px' : '12px';
                fillPolyline.setIcons(fillIcons);
              }
            }
          }
        }
      });

      // Clear existing markers and polylines
      markersRef.current.forEach((marker) => {
        marker.setMap(null);
        // Close any associated label windows
        if ((marker as any).labelWindow) {
          (marker as any).labelWindow.close();
          (marker as any).labelWindow = null;
        }
      });
      polylinesRef.current.forEach((polyline) => polyline.setMap(null));
      animatedPolylinesRef.current.forEach((polyline) => polyline.setMap(null));
      pipelineNameLabelsRef.current.forEach((labelData: any) => {
        if (labelData && labelData.label) {
          labelData.label.close();
        }
      });
      pipelineNameLinesRef.current.forEach((line) => {
        if (line) line.setMap(null);
      });
      markersRef.current = [];
      polylinesRef.current = [];
      animatedPolylinesRef.current = [];
      pipelineNameLabelsRef.current = [];
      pipelineNameLinesRef.current = [];
      
      // Clear any existing animation interval
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
        animationIntervalRef.current = null;
      }

      // Use the same India bounds for filtering locations (defined above)
      // Helper function to check if coordinates are within India
      const isWithinIndia = (lat: number, lng: number): boolean => {
        return lat >= 6 && lat <= 37 &&
               lng >= 68 && lng <= 98;
      };

      // Draw pipelines and locations - ensure proper connections
      // Create icon factory with current data URLs
      const createLocationIcon = createLocationIconFactory(iconDataUrls);
      
      // First pass: Collect all pipeline midpoints for overlap detection
      const pipelineMidpoints: Array<{ pipeline: Pipeline; midPoint: { lat: number; lng: number }; index: number }> = [];
      pipelines.forEach((pipeline, pipelineIndex) => {
        if (pipeline.main_route?.coordinates && pipeline.main_route.coordinates.length > 0) {
          const mainRoutePath = pipeline.main_route.coordinates.map((coord: number[]) => ({
            lat: coord[1],
            lng: coord[0],
          }));
          const midIndex = Math.floor(mainRoutePath.length / 2);
          const midPoint = mainRoutePath[midIndex];
          pipelineMidpoints.push({ pipeline, midPoint, index: pipelineIndex });
        }
      });

      // Calculate label positions with overlap avoidance
      // Move labels much further away at lower zoom levels to prevent cluttering
      const currentZoom = map.getZoom() || 5;
      const baseOffsetDistance = 0.5; // Significantly increased base distance
      const zoomFactor = currentZoom <= 4 ? 6.0 : currentZoom <= 5 ? 4.5 : currentZoom <= 6 ? 3.0 : currentZoom <= 7 ? 2.0 : 1.0;
      const baseOffset = baseOffsetDistance * zoomFactor;
      const minLabelDistance = 0.2 * zoomFactor; // Significantly increased minimum distance between labels to avoid overlap
      
      // Direction angles to try (in degrees, relative to east)
      const directions = [
        { angle: 45, name: 'northeast' },   // Default
        { angle: 135, name: 'northwest' },
        { angle: 225, name: 'southwest' },
        { angle: 315, name: 'southeast' },
        { angle: 0, name: 'east' },
        { angle: 90, name: 'north' },
        { angle: 180, name: 'west' },
        { angle: 270, name: 'south' },
      ];
      
      const labelPositions: Array<{ pipeline: Pipeline; midPoint: { lat: number; lng: number }; labelPosition: { lat: number; lng: number }; index: number }> = [];
      
      // Calculate positions for each pipeline, avoiding overlaps
      pipelineMidpoints.forEach(({ pipeline, midPoint, index }) => {
        let bestPosition: { lat: number; lng: number } | null = null;
        let bestDirection = directions[0];
        
        // Try each direction to find one that doesn't overlap
        for (const direction of directions) {
          const angleRad = (direction.angle * Math.PI) / 180;
          const candidatePosition = {
            lat: midPoint.lat + baseOffset * Math.sin(angleRad),
            lng: midPoint.lng + baseOffset * Math.cos(angleRad),
          };
          
          // Check if this position overlaps with existing labels
          let hasOverlap = false;
          for (const existing of labelPositions) {
            const distance = Math.sqrt(
              Math.pow(candidatePosition.lat - existing.labelPosition.lat, 2) +
              Math.pow(candidatePosition.lng - existing.labelPosition.lng, 2)
            );
            if (distance < minLabelDistance) {
              hasOverlap = true;
              break;
            }
          }
          
          if (!hasOverlap) {
            bestPosition = candidatePosition;
            bestDirection = direction;
            break;
          }
        }
        
        // If all directions overlap, use the default but increase distance (much further at low zoom)
        if (!bestPosition) {
          const angleRad = (bestDirection.angle * Math.PI) / 180;
          const fallbackMultiplier = currentZoom <= 4 ? 2.5 : currentZoom <= 5 ? 2.2 : currentZoom <= 6 ? 2.0 : 1.8;
          bestPosition = {
            lat: midPoint.lat + baseOffset * fallbackMultiplier * Math.sin(angleRad),
            lng: midPoint.lng + baseOffset * fallbackMultiplier * Math.cos(angleRad),
          };
        }
        
        labelPositions.push({
          pipeline,
          midPoint,
          labelPosition: bestPosition,
          index,
        });
      });
      
      // Second pass: Render pipelines with calculated label positions
      pipelines.forEach((pipeline, pipelineIndex) => {
        // Get pipeline color from API
        let pipelineColor = pipeline.pipeline_color || '#0066CC';
        
        // Ensure color has # prefix
        if (pipelineColor && !pipelineColor.startsWith('#')) {
          pipelineColor = '#' + pipelineColor;
        }
        
        // Create two-tone effect: dark border + bright inner fill
        const borderColor = darkenColor(pipelineColor); // Dark border
        const fillColor = brightenColor(pipelineColor); // Bright inner fill
        
        const google = window.google.maps;
        
        // Determine if this pipeline should have dotted/dashed border (alternate pipelines)
        const useDottedBorder = pipelineIndex % 2 === 1;
        
        // Draw main route with two-tone styling (border + fill) - filter to India only
        if (pipeline.main_route?.coordinates && pipeline.main_route.coordinates.length > 0) {
          let mainRoutePath = pipeline.main_route.coordinates
            .filter((coord) => isWithinIndia(coord[1], coord[0]))
            .map((coord) => ({
              lat: coord[1],
              lng: coord[0],
            }));
          
          // Clean and simplify path to remove duplicates, loops, and reverse paths (A->B->A)
          // This ensures only one direction is shown between any two locations (e.g., Hassan->Yedur, not both ways)
          if (mainRoutePath.length > 0) {
            // DEBUG: Log original path info
            console.log(`[DEBUG] ==========================================`);
            console.log(`[DEBUG] Pipeline: ${pipeline.name}`);
            console.log(`[DEBUG] Original path length: ${mainRoutePath.length}`);
            console.log(`[DEBUG] Original first point: lat=${mainRoutePath[0].lat.toFixed(6)}, lng=${mainRoutePath[0].lng.toFixed(6)}`);
            console.log(`[DEBUG] Original last point: lat=${mainRoutePath[mainRoutePath.length - 1].lat.toFixed(6)}, lng=${mainRoutePath[mainRoutePath.length - 1].lng.toFixed(6)}`);
            
            // DEBUG: Log sample points along the path (first, 25%, 50%, 75%, last)
            const sampleIndices = [
              0,
              Math.floor(mainRoutePath.length * 0.25),
              Math.floor(mainRoutePath.length * 0.5),
              Math.floor(mainRoutePath.length * 0.75),
              mainRoutePath.length - 1
            ];
            console.log(`[DEBUG] Sample points along original path:`);
            sampleIndices.forEach((idx, i) => {
              const point = mainRoutePath[idx];
              console.log(`[DEBUG]   Point ${i + 1} (index ${idx}): lat=${point.lat.toFixed(6)}, lng=${point.lng.toFixed(6)}`);
            });
            
            const minDistance = 0.0001; // Minimum distance between points (~11 meters)
            const locationTolerance = 0.001; // Tolerance for detecting same location (~111 meters) - increased for better detection
            
            // Helper function to calculate distance between two points (in degrees)
            const getDistance = (p1: { lat: number; lng: number }, p2: { lat: number; lng: number }) => {
              return Math.sqrt(
                Math.pow(p1.lng - p2.lng, 2) + 
                Math.pow(p1.lat - p2.lat, 2)
              );
            };
            
            // Helper function to check if two points are the same location
            const isSameLocation = (p1: { lat: number; lng: number }, p2: { lat: number; lng: number }) => {
              return getDistance(p1, p2) < locationTolerance;
            };
            
            // First pass: Remove duplicate consecutive points
            const deduplicatedPath: Array<{ lat: number; lng: number }> = [];
            for (let i = 0; i < mainRoutePath.length; i++) {
              const point = mainRoutePath[i];
              if (deduplicatedPath.length === 0 || getDistance(point, deduplicatedPath[deduplicatedPath.length - 1]) >= minDistance) {
                deduplicatedPath.push(point);
              }
            }
            
            // DEBUG: Log deduplicated path info
            console.log(`[DEBUG] Deduplicated path length: ${deduplicatedPath.length}`);
            console.log(`[DEBUG] Deduplicated first point: lat=${deduplicatedPath[0].lat.toFixed(6)}, lng=${deduplicatedPath[0].lng.toFixed(6)}`);
            console.log(`[DEBUG] Deduplicated last point: lat=${deduplicatedPath[deduplicatedPath.length - 1].lat.toFixed(6)}, lng=${deduplicatedPath[deduplicatedPath.length - 1].lng.toFixed(6)}`);
            
            // Second pass: Detect and remove reverse paths (A->B->A pattern)
            // Use distance-based matching instead of exact coordinate matching
            const cleanedPath: Array<{ lat: number; lng: number }> = [];
            let reversePathDetections = 0;
            
            for (let i = 0; i < deduplicatedPath.length; i++) {
              const currentPoint = deduplicatedPath[i];
              let isReversePath = false;
              let reverseIndex = -1;
              let matchedPoint: { lat: number; lng: number } | null = null;
              
              // Check if current point is close to any previously visited point (not immediate previous)
              // This detects when we're returning to a location we've been to before
              // Start from the second-to-last point to avoid matching the immediate previous point
              for (let j = cleanedPath.length - 2; j >= 0; j--) {
                const previousPoint = cleanedPath[j];
                const distance = getDistance(currentPoint, previousPoint);
                
                // If we're close to a previously visited point (and it's not the immediate previous),
                // we're likely backtracking - this is a reverse path
                if (distance < locationTolerance) {
                  isReversePath = true;
                  reverseIndex = j;
                  matchedPoint = previousPoint;
                  break;
                }
              }
              
              if (isReversePath && reverseIndex >= 0 && matchedPoint) {
                reversePathDetections++;
                // DEBUG: Log reverse path detection
                console.log(`[DEBUG] Reverse path detected at index ${i}:`);
                console.log(`[DEBUG]   Current point: lat=${currentPoint.lat.toFixed(6)}, lng=${currentPoint.lng.toFixed(6)}`);
                console.log(`[DEBUG]   Matched point at index ${reverseIndex}: lat=${matchedPoint.lat.toFixed(6)}, lng=${matchedPoint.lng.toFixed(6)}`);
                console.log(`[DEBUG]   Distance: ${getDistance(currentPoint, matchedPoint).toFixed(6)} degrees`);
                console.log(`[DEBUG]   Removing ${cleanedPath.length - (reverseIndex + 1)} points after index ${reverseIndex}`);
                
                // We're returning to a location we visited before
                // Remove all points after the first visit to this location (including the intermediate points)
                // This keeps only the forward path (e.g., Hassan->Yedur, removing Yedur->Hassan)
                // Keep the point at reverseIndex (the first visit), remove everything after it
                const pointsToRemove = cleanedPath.length - (reverseIndex + 1);
                if (pointsToRemove > 0) {
                  cleanedPath.splice(reverseIndex + 1);
                  console.log(`[DEBUG]   Path after removal: ${cleanedPath.length} points`);
                }
                // Don't add the current point since we're removing the reverse path
                // The path now ends at the first visit to this location
                continue;
              }
              
              // Add the point to cleaned path
              cleanedPath.push(currentPoint);
            }
            
            // DEBUG: Log reverse path detection summary
            if (reversePathDetections > 0) {
              console.log(`[DEBUG] Total reverse path detections: ${reversePathDetections}`);
            }
            
            // Third pass: Check if path loops back to start (A->B->A pattern at path level)
            // If the path starts and ends at the same location, find the midpoint and keep only one direction
            if (cleanedPath.length > 3) {
              const first = cleanedPath[0];
              const last = cleanedPath[cleanedPath.length - 1];
              const startEndDistance = getDistance(first, last);
              
              // DEBUG: Check for loop
              console.log(`[DEBUG] Start-end distance: ${startEndDistance.toFixed(6)} degrees (tolerance: ${locationTolerance})`);
              
              // If path starts and ends at same location, it's a complete loop
              if (isSameLocation(first, last)) {
                console.log(`[DEBUG] Complete loop detected! Path starts and ends at same location`);
                console.log(`[DEBUG]   Start point: lat=${first.lat.toFixed(6)}, lng=${first.lng.toFixed(6)}`);
                console.log(`[DEBUG]   End point: lat=${last.lat.toFixed(6)}, lng=${last.lng.toFixed(6)}`);
                
                // Find the point farthest from start (likely the destination like Yedur)
                let maxDistance = 0;
                let farthestIndex = 0;
                
                for (let i = 1; i < cleanedPath.length - 1; i++) {
                  const distance = getDistance(first, cleanedPath[i]);
                  if (distance > maxDistance) {
                    maxDistance = distance;
                    farthestIndex = i;
                  }
                }
                
                console.log(`[DEBUG]   Farthest point at index ${farthestIndex}: lat=${cleanedPath[farthestIndex].lat.toFixed(6)}, lng=${cleanedPath[farthestIndex].lng.toFixed(6)}`);
                console.log(`[DEBUG]   Distance from start: ${maxDistance.toFixed(6)} degrees`);
                
                // Keep only the path from start to the farthest point (one direction only)
                if (farthestIndex > 0 && farthestIndex < cleanedPath.length - 1) {
                  console.log(`[DEBUG]   Removing ${cleanedPath.length - (farthestIndex + 1)} points after farthest point`);
                  cleanedPath.splice(farthestIndex + 1);
                } else {
                  // If we can't find a clear midpoint, just remove the duplicate end
                  console.log(`[DEBUG]   Removing duplicate end point`);
                  cleanedPath.pop();
                }
              }
            }
            
            // Ensure we have at least 2 points for a valid polyline
            if (cleanedPath.length < 2 && mainRoutePath.length >= 2) {
              cleanedPath.push(mainRoutePath[mainRoutePath.length - 1]);
            }
            
            // Final check: if path starts and ends at same point, remove the duplicate end
            if (cleanedPath.length > 2) {
              const first = cleanedPath[0];
              const last = cleanedPath[cleanedPath.length - 1];
              if (isSameLocation(first, last)) {
                console.log(`[DEBUG] Final cleanup: Removing duplicate end point`);
                cleanedPath.pop(); // Remove duplicate end point
              }
            }
            
            // DEBUG: Log final cleaned path info
            console.log(`[DEBUG] Final cleaned path length: ${cleanedPath.length}`);
            console.log(`[DEBUG] Final first point: lat=${cleanedPath[0].lat.toFixed(6)}, lng=${cleanedPath[0].lng.toFixed(6)}`);
            console.log(`[DEBUG] Final last point: lat=${cleanedPath[cleanedPath.length - 1].lat.toFixed(6)}, lng=${cleanedPath[cleanedPath.length - 1].lng.toFixed(6)}`);
            console.log(`[DEBUG] Path reduction: ${mainRoutePath.length} -> ${cleanedPath.length} points (${((1 - cleanedPath.length / mainRoutePath.length) * 100).toFixed(1)}% reduction)`);
            
            // DEBUG: Log sample points along cleaned path
            if (cleanedPath.length > 0) {
              const cleanedSampleIndices = [
                0,
                cleanedPath.length > 1 ? Math.floor(cleanedPath.length * 0.25) : 0,
                cleanedPath.length > 2 ? Math.floor(cleanedPath.length * 0.5) : cleanedPath.length - 1,
                cleanedPath.length > 3 ? Math.floor(cleanedPath.length * 0.75) : cleanedPath.length - 1,
                cleanedPath.length - 1
              ].filter((idx, i, arr) => i === 0 || idx !== arr[i - 1]); // Remove duplicates
              
              console.log(`[DEBUG] Sample points along cleaned path:`);
              cleanedSampleIndices.forEach((idx, i) => {
                const point = cleanedPath[idx];
                console.log(`[DEBUG]   Point ${i + 1} (index ${idx}): lat=${point.lat.toFixed(6)}, lng=${point.lng.toFixed(6)}`);
              });
            }
            
            // DEBUG: Check for known locations (Hassan and Yedur approximate coordinates)
            // Hassan, Karnataka: ~13.0059°N, 76.1025°E
            // Yedur, Karnataka: ~13.5°N, 76.5°E (approximate)
            const hassanApprox = { lat: 13.0059, lng: 76.1025 };
            const yedurApprox = { lat: 13.5, lng: 76.5 };
            const locationCheckTolerance = 0.1; // ~11km tolerance for location check
            
            cleanedPath.forEach((point, idx) => {
              const distToHassan = getDistance(point, hassanApprox);
              const distToYedur = getDistance(point, yedurApprox);
              
              if (distToHassan < locationCheckTolerance) {
                console.log(`[DEBUG] ⚠️  Point near Hassan at index ${idx}: lat=${point.lat.toFixed(6)}, lng=${point.lng.toFixed(6)} (distance: ${distToHassan.toFixed(4)} degrees)`);
              }
              if (distToYedur < locationCheckTolerance) {
                console.log(`[DEBUG] ⚠️  Point near Yedur at index ${idx}: lat=${point.lat.toFixed(6)}, lng=${point.lng.toFixed(6)} (distance: ${distToYedur.toFixed(4)} degrees)`);
              }
            });
            
            console.log(`[DEBUG] ==========================================`);
            
            mainRoutePath = cleanedPath;
          }

          // Calculate stroke weights based on zoom level for better visibility at low zoom
          const currentZoom = map.getZoom() || 5;
          // Thicker strokes at low zoom for better visibility
          let borderWeight = 8; // Default
          let fillWeight = 5; // Default
          
          if (currentZoom <= 4) {
            borderWeight = 14; // Much thicker at very low zoom
            fillWeight = 10;
          } else if (currentZoom <= 5) {
            borderWeight = 12; // Thicker at low zoom
            fillWeight = 8;
          } else if (currentZoom <= 6) {
            borderWeight = 10;
            fillWeight = 6;
          }
          
          // Draw dark border first (thicker, behind) - two-tone effect
          const mainRouteBorder = new google.Polyline({
            path: mainRoutePath,
            geodesic: true,
            strokeColor: borderColor,
            strokeOpacity: 1,
            strokeWeight: borderWeight, // Dynamic based on zoom
            map: map,
            icons: useDottedBorder ? [{
              icon: {
                path: 'M 0,-1 0,1',
                strokeOpacity: 1,
                strokeWeight: borderWeight,
                strokeColor: borderColor,
                scale: 1,
              },
              offset: '0%',
              repeat: currentZoom <= 5 ? '16px' : '12px', // Larger dashes at low zoom
            }] : undefined,
            zIndex: 0, // Behind the fill
          });
          
          // Draw bright inner fill (thinner, on top) - two-tone effect
          const mainRouteFill = new google.Polyline({
            path: mainRoutePath,
            geodesic: true,
            strokeColor: fillColor,
            strokeOpacity: 1,
            strokeWeight: fillWeight, // Dynamic based on zoom
            map: map,
            icons: useDottedBorder ? [{
              icon: {
                path: 'M 0,-1 0,1',
                strokeOpacity: 1,
                strokeWeight: fillWeight,
                strokeColor: fillColor,
                scale: 1,
              },
              offset: '0%',
              repeat: currentZoom <= 5 ? '16px' : '12px', // Match border pattern
            }] : undefined,
            zIndex: 1, // On top of border
          });
          
          // Add pipeline name label with dotted arrow line connection
          if (mainRoutePath.length > 0) {
            const midIndex = Math.floor(mainRoutePath.length / 2);
            const midPoint = mainRoutePath[midIndex];
            
            // Find the pre-calculated label position for this pipeline
            const labelDataForPipeline = labelPositions.find(lp => lp.index === pipelineIndex);
            const labelPosition = labelDataForPipeline 
              ? labelDataForPipeline.labelPosition 
              : {
                  // Fallback if not found (shouldn't happen)
                  lat: midPoint.lat + baseOffset * 0.5,
                  lng: midPoint.lng + baseOffset,
                };
            
            const currentZoom = map.getZoom() || 5;
            
            // Create dotted line from label position to pipeline midpoint (arrow pointing to pipeline)
            // Make line more visible when zoomed out
            const lineOpacity = currentZoom <= 5 ? 0.9 : 0.7;
            const lineWeight = currentZoom <= 5 ? 3 : 2;
            const dotRepeat = currentZoom <= 5 ? '10px' : '8px'; // Larger dots when zoomed out
            
            const dottedLine = new google.Polyline({
              path: [labelPosition, midPoint],
              geodesic: true,
              strokeColor: '#2563EB',
              strokeOpacity: lineOpacity,
              strokeWeight: lineWeight,
              map: map,
              icons: [
                // Dotted pattern along the line
                {
                  icon: {
                    path: 'M 0,-1 0,1',
                    strokeOpacity: 1,
                    strokeWeight: lineWeight,
                    strokeColor: '#2563EB',
                    scale: 1,
                  },
                  offset: '0%',
                  repeat: dotRepeat, // Dotted pattern spacing (larger when zoomed out)
                },
                // Arrowhead at the end (pointing to pipeline)
                {
                  icon: {
                    path: google.SymbolPath.FORWARD_CLOSED_ARROW,
                    strokeColor: '#2563EB',
                    strokeWeight: 2,
                    fillColor: '#2563EB',
                    fillOpacity: 1,
                    scale: currentZoom <= 5 ? 5 : 4, // Larger arrow when zoomed out
                    rotation: 0, // Will be calculated based on line direction
                  },
                  offset: '100%', // At the end of the line (pipeline side)
                },
              ],
              zIndex: 3, // Above pipelines but below markers
            });
            
            // Calculate arrow rotation to point towards pipeline
            const dx = midPoint.lng - labelPosition.lng;
            const dy = midPoint.lat - labelPosition.lat;
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            
            // Update arrow rotation
            if (dottedLine.getIcons && dottedLine.getIcons().length > 1) {
              const icons = dottedLine.getIcons();
              if (icons[1] && icons[1].icon) {
                icons[1].icon.rotation = angle;
                dottedLine.setIcons(icons);
              }
            }
            
            // Store line and label together for zoom updates
            // Also store line separately for cleanup
            pipelineNameLinesRef.current.push(dottedLine);
            
            const labelData = {
              line: dottedLine,
              label: null as any,
              midPoint: midPoint,
              baseOffsetDistance: baseOffsetDistance,
              pipelineIndex: pipelineIndex, // Store index for zoom updates
            };
            
            const pipelineNameContent = `
              <style>
                .pipeline-name-wrapper .gm-style-iw {
                  background: transparent !important;
                  padding: 0 !important;
                  box-shadow: none !important;
                  border: none !important;
                }
                .pipeline-name-wrapper .gm-style-iw-d {
                  overflow: visible !important;
                  padding: 0 !important;
                }
                .pipeline-name-wrapper .gm-ui-hover-effect {
                  display: none !important;
                }
              </style>
              <div class="pipeline-name-wrapper">
                <div style="
                  position: relative;
                  display: inline-flex;
                  align-items: center;
                  background: #2563EB;
                  border-radius: 4px;
                  padding: 6px 12px;
                  font-family: Arial, sans-serif;
                  font-size: 12px;
                  font-weight: bold;
                  color: #FFFFFF;
                  white-space: nowrap;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                ">
                  <span>${pipeline.name}</span>
                  <div style="
                    position: absolute;
                    left: 100%;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 0;
                    height: 0;
                    border-top: 8px solid transparent;
                    border-bottom: 8px solid transparent;
                    border-left: 8px solid #2563EB;
                  "></div>
                </div>
              </div>
            `;
            
            // Create label
            const pipelineNameLabel = new google.InfoWindow({
              content: pipelineNameContent,
              position: labelPosition,
              disableAutoPan: true,
            });
            
            labelData.label = pipelineNameLabel;
            
            pipelineNameLabel.addListener('domready', () => {
              const closeButtons = document.querySelectorAll('.gm-ui-hover-effect');
              closeButtons.forEach((btn) => {
                (btn as HTMLElement).style.display = 'none';
              });
              const iwContents = document.querySelectorAll('.gm-style-iw-c');
              iwContents.forEach((content) => {
                (content as HTMLElement).style.background = 'transparent';
                (content as HTMLElement).style.padding = '0';
                (content as HTMLElement).style.boxShadow = 'none';
              });
              const iwParents = document.querySelectorAll('.gm-style-iw-d');
              iwParents.forEach((parent) => {
                (parent as HTMLElement).style.overflow = 'visible';
                (parent as HTMLElement).style.padding = '0';
              });
            });
            
            pipelineNameLabel.open(map);
            pipelineNameLabelsRef.current.push(labelData);
          }
          
          // Add click listener to show pipeline info callout (only when clicking directly on the line)
          const showPipelineInfo = (event: any) => {
            // Mark that this click was handled
            clickHandled = true;
            
            // Get clicked position (coordinates)
            const clickedLat = event.latLng.lat();
            const clickedLng = event.latLng.lng();
            
            // Check if click is actually on or very close to the pipeline (within reasonable distance)
            let minDistance = Infinity;
            let closestPoint = mainRoutePath[0];
            
            // Check distance to each segment of the path
            for (let i = 0; i < mainRoutePath.length - 1; i++) {
              const p1 = mainRoutePath[i];
              const p2 = mainRoutePath[i + 1];
              
              // Calculate distance from point to line segment
              const A = clickedLng - p1.lng;
              const B = clickedLat - p1.lat;
              const C = p2.lng - p1.lng;
              const D = p2.lat - p1.lat;
              
              const dot = A * C + B * D;
              const lenSq = C * C + D * D;
              let param = -1;
              
              if (lenSq !== 0) param = dot / lenSq;
              
              let xx, yy;
              
              if (param < 0) {
                xx = p1.lng;
                yy = p1.lat;
              } else if (param > 1) {
                xx = p2.lng;
                yy = p2.lat;
              } else {
                xx = p1.lng + param * C;
                yy = p1.lat + param * D;
              }
              
              const dx = clickedLng - xx;
              const dy = clickedLat - yy;
              const distance = Math.sqrt(dx * dx + dy * dy);
              
              if (distance < minDistance) {
                minDistance = distance;
                closestPoint = { lat: yy, lng: xx };
              }
            }
            
            // Increased threshold to allow clicking anywhere near the pipeline (approximately 0.05 degrees ~ 5km)
            // This makes it much easier to click on pipelines
            const threshold = 0.05;
            if (minDistance > threshold) {
              // Click is too far from pipeline, don't show info
              clickHandled = false;
              return;
            }
            
            // Close any existing info windows
            if (pipelineInfoWindowRef.current) {
              pipelineInfoWindowRef.current.close();
              pipelineInfoWindowRef.current = null;
            }
            if (locationInfoWindowRef.current) {
              locationInfoWindowRef.current.close();
              locationInfoWindowRef.current = null;
            }
            
            // Store pipeline info data for zoom updates
            pipelineInfoDataRef.current = {
              closestPoint: closestPoint,
              clickedPoint: { lat: clickedLat, lng: clickedLng },
              pipeline: pipeline
            };
            
            // Calculate arrow position based on zoom - further at low zoom, closer at high zoom
            const currentZoom = map.getZoom() || 5;
            // Calculate offset distance based on zoom (larger at low zoom)
            let offsetDistance = 0.15; // Base offset in degrees
            if (currentZoom <= 4) {
              offsetDistance = 0.25; // Further at very low zoom
            } else if (currentZoom <= 5) {
              offsetDistance = 0.20; // Further at low zoom
            } else if (currentZoom <= 6) {
              offsetDistance = 0.15; // Medium distance
            } else {
              offsetDistance = 0.10; // Closer at high zoom
            }
            
            // Calculate direction from closest point to clicked point
            const dx = clickedLng - closestPoint.lng;
            const dy = clickedLat - closestPoint.lat;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Normalize direction vector
            const dirX = distance > 0 ? dx / distance : 1;
            const dirY = distance > 0 ? dy / distance : 0;
            
            // Position info window offset from closest point (away from pipeline)
            const infoWindowPosition = {
              lat: closestPoint.lat + dirY * offsetDistance,
              lng: closestPoint.lng + dirX * offsetDistance
            };
            
            // Find the nearest location to the clicked point for showing location details
            let nearestLocation: Location | null = null;
            let nearestDistance = Infinity;
            
            pipeline.locations?.forEach((location) => {
              const locLat = location.coordinates.latitude;
              const locLng = location.coordinates.longitude;
              const dist = Math.sqrt(
                Math.pow(clickedLng - locLng, 2) + Math.pow(clickedLat - locLat, 2)
              );
              if (dist < nearestDistance) {
                nearestDistance = dist;
                nearestLocation = location;
              }
            });
            
            // If a location is found, set it as selected to show in the details panel
            if (nearestLocation) {
              setSelectedLocation({ location: nearestLocation, pipeline: pipeline });
            }
            
            // Get year of commission from phases (format like "VVPL: 1998, VSPL: 2002")
            const phaseCommissions = pipeline.phases?.map((phase: any) => {
              if (phase.commissioning && phase.phase_code) {
                return `${phase.phase_code}: ${phase.commissioning}`;
              }
              return phase.commissioning || null;
            }).filter(Boolean) || [];
            const yearsOfComm = phaseCommissions.length > 0 ? phaseCommissions.join('<br/>') : 'N/A';
            
            // Create callout content with yellow styling and arrow (matching image format, no white background, no close button)
            // Include location information if available
            const locationInfo = nearestLocation 
              ? `<div style="margin: 3px 0; margin-top: 6px; padding-top: 6px; border-top: 1px solid #F9A825;">
                  <div style="font-weight: bold; margin-bottom: 3px;">Nearest Location:</div>
                  <div><strong>Name:</strong> ${nearestLocation.location_name}</div>
                  <div><strong>Type:</strong> ${nearestLocation.location_type?.replace(/_/g, ' ')}</div>
                  <div><strong>Code:</strong> ${nearestLocation.location_code}</div>
                  <div><strong>State:</strong> ${nearestLocation.state}</div>
                </div>`
              : '';
            
            const calloutContent = `
              <style>
                .pipeline-info-wrapper .gm-style-iw {
                  background: transparent !important;
                  padding: 0 !important;
                  box-shadow: none !important;
                  border: none !important;
                }
                .pipeline-info-wrapper .gm-style-iw-d {
                  overflow: visible !important;
                  padding: 0 !important;
                }
                .pipeline-info-wrapper .gm-ui-hover-effect {
                  display: none !important;
                }
              </style>
              <div class="pipeline-info-wrapper">
                <div style="
                  background: #FFEB3B;
                  border: 2px solid #F9A825;
                  border-radius: 6px;
                  padding: 8px 10px;
                  font-family: Arial, sans-serif;
                  font-size: 11px;
                  color: #000;
                  min-width: 180px;
                  box-shadow: 0 3px 6px rgba(0,0,0,0.3);
                  position: relative;
                ">
                  <div style="margin: 3px 0;">
                    <strong>Length :</strong> ${pipeline.total_length_km?.toFixed(2) || '0'} Kms
                  </div>
                  <div style="margin: 3px 0;">
                    <strong>Diameter :</strong> ${pipeline.pipe_size_inch || 'N/A'}
                  </div>
                  <div style="margin: 3px 0;">
                    <strong>Capacity :</strong> ${pipeline.capacity?.value || '0'} ${pipeline.capacity?.unit || 'MMTPA'}
                  </div>
                  <div style="margin: 3px 0;">
                    <strong>Year Of Comm :</strong>
                  </div>
                  <div style="margin-left: 10px; margin-top: 2px;">
                    ${yearsOfComm}
                  </div>
                  <div style="margin: 3px 0; margin-top: 4px; font-size: 10px; color: #555;">
                    <strong>Coordinates:</strong> ${clickedLat.toFixed(4)}, ${clickedLng.toFixed(4)}
                  </div>
                  ${locationInfo}
                  <div style="
                    position: absolute;
                    bottom: -8px;
                    left: 15px;
                    width: 0;
                    height: 0;
                    border-left: 8px solid transparent;
                    border-right: 8px solid transparent;
                    border-top: 8px solid #FFEB3B;
                  "></div>
                  <div style="
                    position: absolute;
                    bottom: -10px;
                    left: 15px;
                    width: 0;
                    height: 0;
                    border-left: 8px solid transparent;
                    border-right: 8px solid transparent;
                    border-top: 8px solid #F9A825;
                  "></div>
                </div>
              </div>
            `;
            
            // Create and open info window (no close button, no white background)
            // Position it offset from the pipeline based on zoom
            const infoWindow = new google.InfoWindow({
              content: calloutContent,
              position: infoWindowPosition,
            });
            
            // Remove close button and white background after InfoWindow is created
            infoWindow.addListener('domready', () => {
              // Hide close button
              const closeButtons = document.querySelectorAll('.gm-ui-hover-effect');
              closeButtons.forEach((btn) => {
                (btn as HTMLElement).style.display = 'none';
              });
              // Remove white background styling
              const iwContents = document.querySelectorAll('.gm-style-iw-c');
              iwContents.forEach((content) => {
                (content as HTMLElement).style.background = 'transparent';
                (content as HTMLElement).style.padding = '0';
                (content as HTMLElement).style.boxShadow = 'none';
              });
              const iwParents = document.querySelectorAll('.gm-style-iw-d');
              iwParents.forEach((parent) => {
                (parent as HTMLElement).style.overflow = 'visible';
                (parent as HTMLElement).style.padding = '0';
              });
            });
            
            infoWindow.open(map);
            pipelineInfoWindowRef.current = infoWindow;
          };
          
          // Add click listeners to both border and fill polylines
          google.event.addListener(mainRouteBorder, 'click', showPipelineInfo);
          google.event.addListener(mainRouteFill, 'click', showPipelineInfo);
          
          // Add animated moving dots along the pipeline
          const animatedPolyline = new google.Polyline({
            path: mainRoutePath,
            geodesic: true,
            strokeOpacity: 0, // Invisible stroke
            strokeWeight: 0,
            map: map,
            icons: [{
              icon: {
                path: google.SymbolPath.CIRCLE,
                scale: 4,
                fillColor: fillColor,
                fillOpacity: 1,
                strokeColor: '#FFFFFF',
                strokeWeight: 1.5,
              },
              offset: '0%',
              repeat: '60px', // Spacing between dots
            }],
            zIndex: 2, // On top of everything
          });
          
          polylinesRef.current.push(mainRouteBorder);
          polylinesRef.current.push(mainRouteFill);
          animatedPolylinesRef.current.push(animatedPolyline);
        }

        // Draw branch lines with proper connections to main route
        if (pipeline.branch_lines && pipeline.branch_lines.length > 0) {
          pipeline.branch_lines.forEach((branch) => {
            // Skip if this is just an endpoint (no actual branch line)
            if (branch.is_endpoint && branch.length_km === 0) {
              return;
            }

            if (branch.geometry?.coordinates && branch.geometry.coordinates.length > 0) {
              // Build connected path: start from main route connection point, then follow branch
              let branchPath: Array<{ lat: number; lng: number }> = [];
              
              // Start from the connection point on main route (from_point) - only if within India
              if (branch.from_point?.latitude && branch.from_point?.longitude &&
                  isWithinIndia(branch.from_point.latitude, branch.from_point.longitude)) {
                branchPath.push({
                  lat: branch.from_point.latitude,
                  lng: branch.from_point.longitude,
                });
              }
              
              // Add branch line coordinates (skip first if it's the same as from_point) - filter to India only
              branch.geometry.coordinates
                .filter((coord) => isWithinIndia(coord[1], coord[0]))
                .forEach((coord, index) => {
                  const point = { lat: coord[1], lng: coord[0] };
                  // Avoid duplicate points
                  if (index === 0 && branch.from_point) {
                    const isDuplicate = 
                      Math.abs(point.lat - branch.from_point.latitude) < 0.0001 &&
                      Math.abs(point.lng - branch.from_point.longitude) < 0.0001;
                    if (!isDuplicate) {
                      branchPath.push(point);
                    }
                  } else {
                    branchPath.push(point);
                  }
                });
              
              // Clean and simplify branch path to remove duplicates, loops, and reverse paths (A->B->A)
              // This ensures only one direction is shown between any two locations
              if (branchPath.length > 0) {
                const minDistance = 0.0001; // Minimum distance between points (~11 meters)
                const locationTolerance = 0.001; // Tolerance for detecting same location (~111 meters) - increased for better detection
                
                // Helper function to calculate distance between two points (in degrees)
                const getDistance = (p1: { lat: number; lng: number }, p2: { lat: number; lng: number }) => {
                  return Math.sqrt(
                    Math.pow(p1.lng - p2.lng, 2) + 
                    Math.pow(p1.lat - p2.lat, 2)
                  );
                };
                
                // Helper function to check if two points are the same location
                const isSameLocation = (p1: { lat: number; lng: number }, p2: { lat: number; lng: number }) => {
                  return getDistance(p1, p2) < locationTolerance;
                };
                
                // First pass: Remove duplicate consecutive points
                const deduplicatedPath: Array<{ lat: number; lng: number }> = [];
                for (let i = 0; i < branchPath.length; i++) {
                  const point = branchPath[i];
                  if (deduplicatedPath.length === 0 || getDistance(point, deduplicatedPath[deduplicatedPath.length - 1]) >= minDistance) {
                    deduplicatedPath.push(point);
                  }
                }
                
                // Second pass: Detect and remove reverse paths (A->B->A pattern)
                // Use distance-based matching instead of exact coordinate matching
                const cleanedBranchPath: Array<{ lat: number; lng: number }> = [];
                
                for (let i = 0; i < deduplicatedPath.length; i++) {
                  const currentPoint = deduplicatedPath[i];
                  let isReversePath = false;
                  let reverseIndex = -1;
                  
                  // Check if current point is close to any previously visited point (not immediate previous)
                  // This detects when we're returning to a location we've been to before
                  // Start from the second-to-last point to avoid matching the immediate previous point
                  for (let j = cleanedBranchPath.length - 2; j >= 0; j--) {
                    const previousPoint = cleanedBranchPath[j];
                    const distance = getDistance(currentPoint, previousPoint);
                    
                    // If we're close to a previously visited point (and it's not the immediate previous),
                    // we're likely backtracking - this is a reverse path
                    if (distance < locationTolerance) {
                      isReversePath = true;
                      reverseIndex = j;
                      break;
                    }
                  }
                  
                  if (isReversePath && reverseIndex >= 0) {
                    // We're returning to a location we visited before
                    // Remove all points after the first visit to this location (including the intermediate points)
                    // This keeps only the forward path
                    // Keep the point at reverseIndex (the first visit), remove everything after it
                    const pointsToRemove = cleanedBranchPath.length - (reverseIndex + 1);
                    if (pointsToRemove > 0) {
                      cleanedBranchPath.splice(reverseIndex + 1);
                    }
                    // Don't add the current point since we're removing the reverse path
                    // The path now ends at the first visit to this location
                    continue;
                  }
                  
                  // Add the point to cleaned path
                  cleanedBranchPath.push(currentPoint);
                }
                
                // Third pass: Check if path loops back to start (A->B->A pattern at path level)
                // If the path starts and ends at the same location, find the midpoint and keep only one direction
                if (cleanedBranchPath.length > 3) {
                  const first = cleanedBranchPath[0];
                  const last = cleanedBranchPath[cleanedBranchPath.length - 1];
                  
                  // If path starts and ends at same location, it's a complete loop
                  if (isSameLocation(first, last)) {
                    // Find the point farthest from start (likely the destination)
                    let maxDistance = 0;
                    let farthestIndex = 0;
                    
                    for (let i = 1; i < cleanedBranchPath.length - 1; i++) {
                      const distance = getDistance(first, cleanedBranchPath[i]);
                      if (distance > maxDistance) {
                        maxDistance = distance;
                        farthestIndex = i;
                      }
                    }
                    
                    // Keep only the path from start to the farthest point (one direction only)
                    if (farthestIndex > 0 && farthestIndex < cleanedBranchPath.length - 1) {
                      cleanedBranchPath.splice(farthestIndex + 1);
                    } else {
                      // If we can't find a clear midpoint, just remove the duplicate end
                      cleanedBranchPath.pop();
                    }
                  }
                }
                
                // Ensure we have at least 2 points for a valid polyline
                if (cleanedBranchPath.length < 2 && branchPath.length >= 2) {
                  cleanedBranchPath.push(branchPath[branchPath.length - 1]);
                }
                
                // Final check: if path starts and ends at same point, remove the duplicate end
                if (cleanedBranchPath.length > 2) {
                  const first = cleanedBranchPath[0];
                  const last = cleanedBranchPath[cleanedBranchPath.length - 1];
                  if (isSameLocation(first, last)) {
                    cleanedBranchPath.pop(); // Remove duplicate end point
                  }
                }
                
                branchPath = cleanedBranchPath;
              }

              // Only draw if we have a valid path
              if (branchPath.length >= 2) {
                // Calculate branch stroke weights based on zoom (slightly thinner than main route)
                let branchBorderWeight = 7;
                let branchFillWeight = 4;
                
                if (currentZoom <= 4) {
                  branchBorderWeight = 12;
                  branchFillWeight = 8;
                } else if (currentZoom <= 5) {
                  branchBorderWeight = 10;
                  branchFillWeight = 6;
                } else if (currentZoom <= 6) {
                  branchBorderWeight = 8;
                  branchFillWeight = 5;
                }
                
                // Draw dark border first (thicker, behind)
                const branchBorder = new google.Polyline({
                  path: branchPath,
                  geodesic: true,
                  strokeColor: borderColor,
                  strokeOpacity: 1,
                  strokeWeight: branchBorderWeight, // Dynamic based on zoom
                  icons: useDottedBorder ? [{
                    icon: {
                      path: 'M 0,-1 0,1',
                      strokeOpacity: 1,
                      strokeWeight: branchBorderWeight,
                      strokeColor: borderColor,
                      scale: 1,
                    },
                    offset: '0%',
                    repeat: currentZoom <= 5 ? '16px' : '12px', // Larger dashes at low zoom
                  }] : undefined,
                  map: map,
                  zIndex: 0, // Behind the fill
                });
                
                // Draw bright inner fill (thinner, on top)
                const branchFill = new google.Polyline({
                  path: branchPath,
                  geodesic: true,
                  strokeColor: fillColor,
                  strokeOpacity: 1,
                  strokeWeight: branchFillWeight, // Dynamic based on zoom
                  icons: useDottedBorder ? [{
                    icon: {
                      path: 'M 0,-1 0,1',
                      strokeOpacity: 1,
                      strokeWeight: branchFillWeight,
                      strokeColor: fillColor,
                      scale: 1,
                    },
                    offset: '0%',
                    repeat: currentZoom <= 5 ? '16px' : '12px', // Match border pattern
                  }] : undefined,
                  map: map,
                  zIndex: 1, // On top of border
                });
                
                // Add click listener to show pipeline info callout for branch lines
                const showBranchPipelineInfo = (event: any) => {
                  // Close any existing info windows
                  if (pipelineInfoWindowRef.current) {
                    pipelineInfoWindowRef.current.close();
                    pipelineInfoWindowRef.current = null;
                  }
                  if (locationInfoWindowRef.current) {
                    locationInfoWindowRef.current.close();
                    locationInfoWindowRef.current = null;
                  }
                  
                  // Get clicked position (coordinates)
                  const clickedLat = event.latLng.lat();
                  const clickedLng = event.latLng.lng();
                  
                  // Check if click is actually on or very close to the branch pipeline
                  let minDistance = Infinity;
                  let closestPoint = branchPath[0];
                  
                  // Check distance to each segment of the branch path
                  for (let i = 0; i < branchPath.length - 1; i++) {
                    const p1 = branchPath[i];
                    const p2 = branchPath[i + 1];
                    
                    // Calculate distance from point to line segment
                    const A = clickedLng - p1.lng;
                    const B = clickedLat - p1.lat;
                    const C = p2.lng - p1.lng;
                    const D = p2.lat - p1.lat;
                    
                    const dot = A * C + B * D;
                    const lenSq = C * C + D * D;
                    let param = -1;
                    
                    if (lenSq !== 0) param = dot / lenSq;
                    
                    let xx, yy;
                    
                    if (param < 0) {
                      xx = p1.lng;
                      yy = p1.lat;
                    } else if (param > 1) {
                      xx = p2.lng;
                      yy = p2.lat;
                    } else {
                      xx = p1.lng + param * C;
                      yy = p1.lat + param * D;
                    }
                    
                    const dx = clickedLng - xx;
                    const dy = clickedLat - yy;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < minDistance) {
                      minDistance = distance;
                      closestPoint = { lat: yy, lng: xx };
                    }
                  }
                  
                  // Increased threshold to allow clicking anywhere near the pipeline (approximately 0.05 degrees ~ 5km)
                  const threshold = 0.05;
                  if (minDistance > threshold) {
                    // Click is too far from pipeline, don't show info
                    return;
                  }
                  
                  // Store pipeline info data for zoom updates
                  pipelineInfoDataRef.current = {
                    closestPoint: closestPoint,
                    clickedPoint: { lat: clickedLat, lng: clickedLng },
                    pipeline: pipeline
                  };
                  
                  // Calculate arrow position based on zoom - further at low zoom, closer at high zoom
                  const currentZoom = map.getZoom() || 5;
                  let offsetDistance = 0.15;
                  if (currentZoom <= 4) {
                    offsetDistance = 0.25;
                  } else if (currentZoom <= 5) {
                    offsetDistance = 0.20;
                  } else if (currentZoom <= 6) {
                    offsetDistance = 0.15;
                  } else {
                    offsetDistance = 0.10;
                  }
                  
                  // Calculate direction from closest point to clicked point
                  const dx = clickedLng - closestPoint.lng;
                  const dy = clickedLat - closestPoint.lat;
                  const distance = Math.sqrt(dx * dx + dy * dy);
                  
                  // Normalize direction vector
                  const dirX = distance > 0 ? dx / distance : 1;
                  const dirY = distance > 0 ? dy / distance : 0;
                  
                  // Position info window offset from closest point (away from pipeline)
                  const infoWindowPosition = {
                    lat: closestPoint.lat + dirY * offsetDistance,
                    lng: closestPoint.lng + dirX * offsetDistance
                  };
                  
                  // Find the nearest location to the clicked point for showing location details
                  let nearestLocation: Location | null = null;
                  let nearestDistance = Infinity;
                  
                  pipeline.locations?.forEach((location) => {
                    const locLat = location.coordinates.latitude;
                    const locLng = location.coordinates.longitude;
                    const dist = Math.sqrt(
                      Math.pow(clickedLng - locLng, 2) + Math.pow(clickedLat - locLat, 2)
                    );
                    if (dist < nearestDistance) {
                      nearestDistance = dist;
                      nearestLocation = location;
                    }
                  });
                  
                  // If a location is found, set it as selected to show in the details panel
                  if (nearestLocation) {
                    setSelectedLocation({ location: nearestLocation, pipeline: pipeline });
                  }
                  
                  // Get year of commission from phases (format like "VVPL: 1998, VSPL: 2002")
                  const phaseCommissions = pipeline.phases?.map((phase: any) => {
                    if (phase.commissioning && phase.phase_code) {
                      return `${phase.phase_code}: ${phase.commissioning}`;
                    }
                    return phase.commissioning || null;
                  }).filter(Boolean) || [];
                  const yearsOfComm = phaseCommissions.length > 0 ? phaseCommissions.join('<br/>') : 'N/A';
                  
                  // Create callout content with yellow styling and arrow (matching image format, no white background, no close button)
                  // Include location information if available
                  const locationInfo = nearestLocation 
                    ? `<div style="margin: 3px 0; margin-top: 6px; padding-top: 6px; border-top: 1px solid #F9A825;">
                        <div style="font-weight: bold; margin-bottom: 3px;">Nearest Location:</div>
                        <div><strong>Name:</strong> ${nearestLocation.location_name}</div>
                        <div><strong>Type:</strong> ${nearestLocation.location_type?.replace(/_/g, ' ')}</div>
                        <div><strong>Code:</strong> ${nearestLocation.location_code}</div>
                        <div><strong>State:</strong> ${nearestLocation.state}</div>
                      </div>`
                    : '';
                  
                  const calloutContent = `
                    <style>
                      .pipeline-info-wrapper .gm-style-iw {
                        background: transparent !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                      }
                      .pipeline-info-wrapper .gm-style-iw-d {
                        overflow: visible !important;
                        padding: 0 !important;
                      }
                      .pipeline-info-wrapper .gm-ui-hover-effect {
                        display: none !important;
                      }
                    </style>
                    <div class="pipeline-info-wrapper">
                      <div style="
                        background: #FFEB3B;
                        border: 2px solid #F9A825;
                        border-radius: 6px;
                        padding: 8px 10px;
                        font-family: Arial, sans-serif;
                        font-size: 11px;
                        color: #000;
                        min-width: 180px;
                        box-shadow: 0 3px 6px rgba(0,0,0,0.3);
                        position: relative;
                      ">
                        <div style="margin: 3px 0;">
                          <strong>Length :</strong> ${pipeline.total_length_km?.toFixed(2) || '0'} Kms
                        </div>
                        <div style="margin: 3px 0;">
                          <strong>Diameter :</strong> ${pipeline.pipe_size_inch || 'N/A'}
                        </div>
                        <div style="margin: 3px 0;">
                          <strong>Capacity :</strong> ${pipeline.capacity?.value || '0'} ${pipeline.capacity?.unit || 'MMTPA'}
                        </div>
                        <div style="margin: 3px 0;">
                          <strong>Year Of Comm :</strong>
                        </div>
                        <div style="margin-left: 10px; margin-top: 2px;">
                          ${yearsOfComm}
                        </div>
                        <div style="margin: 3px 0; margin-top: 4px; font-size: 10px; color: #555;">
                          <strong>Coordinates:</strong> ${clickedLat.toFixed(4)}, ${clickedLng.toFixed(4)}
                        </div>
                        ${locationInfo}
                        <div style="
                          position: absolute;
                          bottom: -8px;
                          left: 15px;
                          width: 0;
                          height: 0;
                          border-left: 8px solid transparent;
                          border-right: 8px solid transparent;
                          border-top: 8px solid #FFEB3B;
                        "></div>
                        <div style="
                          position: absolute;
                          bottom: -10px;
                          left: 15px;
                          width: 0;
                          height: 0;
                          border-left: 8px solid transparent;
                          border-right: 8px solid transparent;
                          border-top: 8px solid #F9A825;
                        "></div>
                      </div>
                    </div>
                  `;
                  
                  // Create and open info window (no close button, no white background)
                  // Position it offset from the pipeline based on zoom
                  const infoWindow = new google.InfoWindow({
                    content: calloutContent,
                    position: infoWindowPosition,
                  });
                  
                  // Remove close button and white background after InfoWindow is created
                  infoWindow.addListener('domready', () => {
                    // Hide close button
                    const closeButtons = document.querySelectorAll('.gm-ui-hover-effect');
                    closeButtons.forEach((btn) => {
                      (btn as HTMLElement).style.display = 'none';
                    });
                    // Remove white background styling
                    const iwContents = document.querySelectorAll('.gm-style-iw-c');
                    iwContents.forEach((content) => {
                      (content as HTMLElement).style.background = 'transparent';
                      (content as HTMLElement).style.padding = '0';
                      (content as HTMLElement).style.boxShadow = 'none';
                    });
                    const iwParents = document.querySelectorAll('.gm-style-iw-d');
                    iwParents.forEach((parent) => {
                      (parent as HTMLElement).style.overflow = 'visible';
                      (parent as HTMLElement).style.padding = '0';
                    });
                  });
                  
                  infoWindow.open(map);
                  pipelineInfoWindowRef.current = infoWindow;
                };
                
                // Add click listeners to branch polylines
                google.event.addListener(branchBorder, 'click', showBranchPipelineInfo);
                google.event.addListener(branchFill, 'click', showBranchPipelineInfo);
                
                // Add animated moving dots along the branch line
                const animatedBranchPolyline = new google.Polyline({
                  path: branchPath,
                  geodesic: true,
                  strokeOpacity: 0,
                  strokeWeight: 0,
                  map: map,
                  icons: [{
                    icon: {
                      path: google.SymbolPath.CIRCLE,
                      scale: 3.5,
                      fillColor: fillColor,
                      fillOpacity: 1,
                      strokeColor: '#FFFFFF',
                      strokeWeight: 1.5,
                    },
                    offset: '0%',
                    repeat: '50px',
                  }],
                  zIndex: 2,
                });
                
                polylinesRef.current.push(branchBorder);
                polylinesRef.current.push(branchFill);
                animatedPolylinesRef.current.push(animatedBranchPolyline);
              }
            }
          });
        }

        // Draw location markers with custom icons based on location_type (matching schematic)
        if (pipeline.locations && pipeline.locations.length > 0) {
          pipeline.locations.forEach((location) => {
            if (!location.coordinates?.latitude || !location.coordinates?.longitude) return;

            const google = window.google.maps;
            
            // Create icon based on location type (matching schematic icons) with current zoom
            const locationIcon = createLocationIcon(location.location_type, window.google, currentZoom);
            
            const marker = new google.Marker({
              position: {
                lat: location.coordinates.latitude,
                lng: location.coordinates.longitude,
              },
              map: map,
              title: location.location_name,
              icon: locationIcon || {
                path: google.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#6B7280',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              },
              optimized: false,
              zIndex: google.Marker.MAX_ZINDEX,
            });
            
            // Store marker reference for icon updates and location data
            (marker as any).locationType = location.location_type;
            (marker as any).locationData = location;
            (marker as any).pipelineData = pipeline;
            
            // Show markers immediately (they remain visible at all zoom levels for better interactivity)
            // Only hide if filter is active and doesn't match
            if (!activeLocationTypeFilter || location.location_type === activeLocationTypeFilter) {
              marker.setMap(map);
            } else {
              marker.setMap(null);
            }
            
            // Add click listener - show blue location name callout and update right panel
            marker.addListener('click', (event: any) => {
              // Mark that this click was handled (prevents closing info windows)
              clickHandled = true;
              
              // Close any existing info windows
              if (pipelineInfoWindowRef.current) {
                pipelineInfoWindowRef.current.close();
                pipelineInfoWindowRef.current = null;
              }
              if (locationInfoWindowRef.current) {
                locationInfoWindowRef.current.close();
                locationInfoWindowRef.current = null;
              }
              
              // Get clicked position
              const clickedLat = location.coordinates.latitude;
              const clickedLng = location.coordinates.longitude;
              
              // Create blue location name callout (similar to yellow pipeline box)
              const locationCalloutContent = `
                <style>
                  .location-info-wrapper .gm-style-iw {
                    background: transparent !important;
                    padding: 0 !important;
                    box-shadow: none !important;
                    border: none !important;
                  }
                  .location-info-wrapper .gm-style-iw-d {
                    overflow: visible !important;
                    padding: 0 !important;
                  }
                  .location-info-wrapper .gm-ui-hover-effect {
                    display: none !important;
                  }
                </style>
                <div class="location-info-wrapper">
                  <div style="
                    background: #1565C0;
                    border: 2px solid #0D47A1;
                    border-radius: 6px;
                    padding: 8px 10px;
                    font-family: Arial, sans-serif;
                    font-size: 11px;
                    color: #FFFFFF;
                    min-width: 150px;
                    box-shadow: 0 3px 6px rgba(0,0,0,0.3);
                    position: relative;
                    text-align: center;
                  ">
                    <div style="font-weight: bold; font-size: 12px; margin-bottom: 2px;">
                      ${location.location_name}
                    </div>
                    <div style="font-size: 10px; opacity: 0.9; margin-top: 2px;">
                      ${location.location_type?.replace(/_/g, ' ') || ''}
                    </div>
                    <div style="
                      position: absolute;
                      bottom: -8px;
                      left: 50%;
                      transform: translateX(-50%);
                      width: 0;
                      height: 0;
                      border-left: 8px solid transparent;
                      border-right: 8px solid transparent;
                      border-top: 8px solid #1565C0;
                    "></div>
                    <div style="
                      position: absolute;
                      bottom: -10px;
                      left: 50%;
                      transform: translateX(-50%);
                      width: 0;
                      height: 0;
                      border-left: 8px solid transparent;
                      border-right: 8px solid transparent;
                      border-top: 8px solid #0D47A1;
                    "></div>
                  </div>
                </div>
              `;
              
              // Create and open info window (no close button, no white background)
              const locationInfoWindow = new google.InfoWindow({
                content: locationCalloutContent,
                position: { lat: clickedLat, lng: clickedLng },
              });
              
              // Remove close button and white background after InfoWindow is created
              locationInfoWindow.addListener('domready', () => {
                // Hide close button
                const closeButtons = document.querySelectorAll('.gm-ui-hover-effect');
                closeButtons.forEach((btn) => {
                  (btn as HTMLElement).style.display = 'none';
                });
                // Remove white background styling
                const iwContents = document.querySelectorAll('.gm-style-iw-c');
                iwContents.forEach((content) => {
                  (content as HTMLElement).style.background = 'transparent';
                  (content as HTMLElement).style.padding = '0';
                  (content as HTMLElement).style.boxShadow = 'none';
                });
                const iwParents = document.querySelectorAll('.gm-style-iw-d');
                iwParents.forEach((parent) => {
                  (parent as HTMLElement).style.overflow = 'visible';
                  (parent as HTMLElement).style.padding = '0';
                });
              });
              
              locationInfoWindow.open(map);
              locationInfoWindowRef.current = locationInfoWindow;
              
              setSelectedLocation({ location, pipeline });
              // Center map on selected location without aggressive zooming
              if (mapInstanceRef.current) {
                const currentZoom = mapInstanceRef.current.getZoom();
                // Only center, don't zoom in too much - keep steady
                mapInstanceRef.current.setCenter({
                  lat: location.coordinates.latitude,
                  lng: location.coordinates.longitude,
                });
                // Use current zoom or a moderate zoom (whichever is less zoomed in)
                // This keeps the map steady and shows context
                const targetZoom = currentZoom && currentZoom < 6 ? currentZoom : 6;
                mapInstanceRef.current.setZoom(targetZoom);
              }
            });

            markersRef.current.push(marker);
          });
        }
      });

      // Fit bounds to show all of India (full minimize/overview mode)
      const googleMapsApi = window.google.maps;
      const indiaBoundsObj = new googleMapsApi.LatLngBounds(
        new googleMapsApi.LatLng(6, 68),   // Southwest corner (south, west)
        new googleMapsApi.LatLng(37, 98)    // Northeast corner (north, east)
      );
      
      // Always fit to show full India by default (minimize mode)
      map.fitBounds(indiaBoundsObj);
      
      // If a location is selected, center on it but keep zoom steady (don't zoom in too much)
      if (selectedLocation && selectedLocation.location.coordinates) {
        setTimeout(() => {
          // Center on location but maintain overview zoom level
          map.setCenter({
            lat: selectedLocation.location.coordinates.latitude,
            lng: selectedLocation.location.coordinates.longitude,
          });
          // Keep zoom at a level that shows context (not too zoomed in)
          const currentZoom = map.getZoom();
          if (!currentZoom || currentZoom > 6) {
            map.setZoom(6); // Moderate zoom that shows surrounding area
          }
        }, 500);
      }
      
      // Start animation for moving dots along pipelines
      let animationOffset = 0;
      animationIntervalRef.current = setInterval(() => {
        animationOffset = (animationOffset + 2) % 100; // Move 2% each frame, loop at 100%
        
        animatedPolylinesRef.current.forEach((polyline) => {
          if (polyline && polyline.getIcons) {
            const icons = polyline.getIcons();
            if (icons && icons.length > 0) {
              icons[0].offset = `${animationOffset}%`;
              polyline.setIcons(icons);
            }
          }
        });
      }, 50); // Update every 50ms for smooth animation
      
      } catch (error) {
        console.error('Error initializing map:', error);
        setError('Failed to initialize map');
      }
    };

    initMap();
    
    // Cleanup animation on unmount
    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
        animationIntervalRef.current = null;
      }
    };
  }, [mapLoaded, pipelines, activeLocationTypeFilter, iconDataUrls]);

  const handleLocationClick = useCallback((location: Location, pipeline: Pipeline) => {
    setSelectedLocation({ location, pipeline });
  }, []);

  // Handle location type filter click
  const handleLocationTypeFilter = useCallback((locationType: string) => {
    setActiveLocationTypeFilter((prev) => {
      // Toggle: if clicking the same filter, clear it; otherwise set new filter
      return prev === locationType ? '' : locationType;
    });
  }, []);

  const handleLaunchSCADA = () => {
    if (!selectedLocation) return;
    
    const encodedName = encodeURIComponent(selectedLocation.pipeline.name);
    const encodedUrl = encodeURIComponent(selectedLocation.pipeline.url);
    navigate(`/pipeline/${encodedName}?url=${encodedUrl}`);
  };

  // Toggle map type between Satellite and Roadmap
  const toggleMapType = useCallback(() => {
    setMapStyle((prev) => {
      const newType = prev === 'satellite' ? 'roadmap' : 'satellite';
      return newType;
    });
  }, []);

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

  // Update marker visibility when filter changes
  useEffect(() => {
    if (!mapLoaded || markersRef.current.length === 0) return;

    const createLocationIcon = createLocationIconFactory(iconDataUrls);
    
    // Keep markers visible at all zoom levels (just make them smaller when zoomed out)
    // This allows clicking on locations even when zoomed out
    markersRef.current.forEach((marker) => {
      if (!marker) return;
      
      const locationType = (marker as any).locationType;
      
      // Always show markers (but respect filter if active)
      if (!activeLocationTypeFilter || locationType === activeLocationTypeFilter) {
        marker.setMap(mapInstanceRef.current);
        // Update icon with current data URLs if available
        if (Object.keys(iconDataUrls).length > 0) {
          const newIcon = createLocationIcon(locationType, window.google, currentZoom);
          marker.setIcon(newIcon);
        }
      } else {
        marker.setMap(null);
      }
    });
  }, [activeLocationTypeFilter, mapLoaded, iconDataUrls, currentZoom]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-sm text-gray-600">Loading pipeline data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const isApiKeyError = error.includes('API key') || error.includes('referrer') || error.includes('RefererNotAllowed');
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="text-center space-y-4 max-w-2xl p-6">
          <p className="text-base font-semibold text-red-600">Error loading pipelines</p>
          <p className="text-sm text-gray-600">{error}</p>
          {isApiKeyError && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-left">
              <p className="text-sm font-semibold text-yellow-800 mb-2">Google Maps API Key Issue:</p>
              <p className="text-xs text-yellow-700 mb-2">
                The API key has referrer restrictions. To fix this:
              </p>
              <ol className="text-xs text-yellow-700 list-decimal list-inside space-y-1">
                <li>Go to Google Cloud Console → APIs & Services → Credentials</li>
                <li>Select your API key</li>
                <li>Under "Application restrictions", add your site URL:</li>
                <li className="ml-4 font-mono">http://localhost:5378/*</li>
                <li>Or use "None" for development (not recommended for production)</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Location type filter buttons data
  const locationTypeFilters = [
    { type: 'DISPATCH_TERMINAL', label: 'Dispatch', icon: ArrowUp, color: '#10B981', image: dispatchImage },
    { type: 'INTERMEDIATE_PUMPING', label: 'Intermediate', icon: Gauge, color: '#8B5CF6', image: intermediatePumpingImage },
    { type: 'RECEIVING_TERMINAL', label: 'Receiving', icon: Download, color: '#3B82F6', image: receivingTerminalImage },
  ];

  return (
    <div className="h-[92vh] w-full flex">
      {/* Map Container */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="w-full h-full" />
        
        {/* Location Type Filter Buttons - Left side (same as IndiaMap) */}
        {mapLoaded && (
          <div className="absolute top-20 left-1 z-30 space-y-4">
            {locationTypeFilters.map((filter) => {
              const IconComponent = filter.icon;
              const isActive = activeLocationTypeFilter === filter.type;
              
              return (
                <div
                  key={filter.type}
                  onClick={() => handleLocationTypeFilter(filter.type)}
                  className={`cursor-pointer transition-all duration-200 hover:scale-105 ${
                    isActive
                      ? 'ring-2 ring-blue-400 shadow-lg shadow-blue-400/50 rounded-lg'
                      : 'hover:ring-1 hover:ring-white/30 rounded-lg'
                  }`}
                  title={`Filter by ${filter.label} Terminal`}
                  style={{ pointerEvents: 'auto' }}
                >
                  <div
                    className="w-16 h-16 rounded-lg flex items-center justify-center border-2 overflow-hidden"
                    style={{
                      backgroundColor: isActive ? '#1E3A8A' : filter.color,
                      borderColor: isActive ? '#3B82F6' : filter.color,
                    }}
                  >
                    {filter.image ? (
                      <img 
                        src={filter.image} 
                        alt={filter.label}
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      <IconComponent 
                        className="w-8 h-8 text-white" 
                        style={{ color: '#FFFFFF' }}
                      />
                    )}
                  </div>
                  <p 
                    className="text-xs text-center mt-1 font-medium"
                    style={{ color: isActive ? '#1E3A8A' : '#374151' }}
                  >
                    {filter.label}
                  </p>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Pipeline Legend - Top Right Corner */}
        {mapLoaded && pipelines.length > 0 && (
          <div className="absolute top-2 right-2 z-30 bg-white/90 backdrop-blur-sm rounded-lg shadow-xl border border-gray-300/50 p-2 max-w-[200px] max-h-[70vh] overflow-y-auto">
            <style>{`
              .pipeline-legend::-webkit-scrollbar {
                width: 4px;
              }
              .pipeline-legend::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 2px;
              }
              .pipeline-legend::-webkit-scrollbar-thumb {
                background: #888;
                border-radius: 2px;
              }
              .pipeline-legend::-webkit-scrollbar-thumb:hover {
                background: #555;
              }
            `}</style>
            <div className="space-y-1.5 pipeline-legend">
              {pipelines.map((pipeline, index) => {
                let pipelineColor = pipeline.pipeline_color || '#0066CC';
                // Ensure color has # prefix
                if (pipelineColor && !pipelineColor.startsWith('#')) {
                  pipelineColor = '#' + pipelineColor;
                }
                
                // Function to handle pipeline click - zoom to pipeline and show info
                const handlePipelineClick = () => {
                  if (!mapInstanceRef.current) return;
                  
                  const map = mapInstanceRef.current;
                  const google = window.google.maps;
                  
                  // Helper function to check if coordinates are within India bounds
                  const isWithinIndiaBounds = (lat: number, lng: number): boolean => {
                    return lat >= 6 && lat <= 37 && lng >= 68 && lng <= 98;
                  };
                  
                  // Calculate bounds for this pipeline
                  const bounds = new google.LatLngBounds();
                  let hasCoordinates = false;
                  
                  // Add main route coordinates to bounds
                  if (pipeline.main_route?.coordinates && pipeline.main_route.coordinates.length > 0) {
                    pipeline.main_route.coordinates.forEach((coord: number[]) => {
                      if (isWithinIndiaBounds(coord[1], coord[0])) {
                        bounds.extend(new google.LatLng(coord[1], coord[0]));
                        hasCoordinates = true;
                      }
                    });
                  }
                  
                  // Add branch line coordinates to bounds
                  if (pipeline.branch_lines && pipeline.branch_lines.length > 0) {
                    pipeline.branch_lines.forEach((branch: any) => {
                      if (branch.geometry?.coordinates) {
                        branch.geometry.coordinates.forEach((coord: number[]) => {
                          if (isWithinIndiaBounds(coord[1], coord[0])) {
                            bounds.extend(new google.LatLng(coord[1], coord[0]));
                            hasCoordinates = true;
                          }
                        });
                      }
                    });
                  }
                  
                  // Add location coordinates to bounds
                  if (pipeline.locations && pipeline.locations.length > 0) {
                    pipeline.locations.forEach((location: Location) => {
                      if (location.coordinates?.latitude && location.coordinates?.longitude) {
                        bounds.extend(new google.LatLng(
                          location.coordinates.latitude,
                          location.coordinates.longitude
                        ));
                        hasCoordinates = true;
                      }
                    });
                  }
                  
                  // Zoom to pipeline bounds
                  if (hasCoordinates) {
                    map.fitBounds(bounds);
                    // Add some padding
                    map.fitBounds(bounds, { padding: 50 });
                  } else {
                    // Fallback: center on first location if available
                    if (pipeline.locations && pipeline.locations.length > 0 && pipeline.locations[0].coordinates) {
                      const firstLocation = pipeline.locations[0];
                      map.setCenter({
                        lat: firstLocation.coordinates.latitude,
                        lng: firstLocation.coordinates.longitude,
                      });
                      map.setZoom(8);
                    }
                  }
                  
                  // Select first location to show pipeline info in right panel
                  if (pipeline.locations && pipeline.locations.length > 0) {
                    const firstLocation = pipeline.locations[0];
                    setSelectedLocation({
                      location: firstLocation,
                      pipeline: pipeline,
                    });
                  }
                };
                
                return (
                  <div
                    key={`${pipeline.name}-${index}`}
                    onClick={handlePipelineClick}
                    className="flex items-center gap-2 py-1.5 px-2 hover:bg-blue-50/80 rounded cursor-pointer transition-colors border-b border-gray-200/50 last:border-b-0"
                    title={`Click to zoom to ${pipeline.name}`}
                  >
                    <div
                      className="w-6 h-1.5 flex-shrink-0 rounded"
                      style={{ 
                        backgroundColor: pipelineColor,
                        opacity: 0.8
                      }}
                    />
                    <span className="text-gray-700 font-medium truncate flex-1 text-[10px]">
                      {pipeline.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Map Type Toggle Button - Below legend */}
        {mapLoaded && (
          <button
            onClick={toggleMapType}
            className="absolute top-2 right-[220px] z-30 px-3 py-2 bg-white hover:bg-gray-50 rounded-lg shadow-lg border border-gray-200 transition-all duration-200 flex items-center justify-center"
            title={mapStyle === 'satellite' ? 'Switch to Roadmap' : 'Switch to Satellite View'}
          >
            {mapStyle === 'satellite' ? (
              <span className="text-gray-700 text-lg">🛰️</span>
            ) : (
              <span className="text-gray-700 text-lg">🗺️</span>
            )}
          </button>
        )}
      </div>

      {/* Right Panel - Using separate component */}
      <PipelineDetailsPanel 
        selectedLocation={selectedLocation} 
        onLaunchSCADA={handleLaunchSCADA}
      />
    </div>
  );
};

export default PipelineMapView;
