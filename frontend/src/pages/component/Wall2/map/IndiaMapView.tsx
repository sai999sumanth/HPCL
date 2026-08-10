import React, { useEffect, useRef, useState } from 'react';
import { Maximize2 } from 'lucide-react';

// Google Maps API Key
const GOOGLE_MAPS_API_KEY = 'AIzaSyDfMVbeSC78K1l78ZCsccs0WENDG6brfVc';
const GOOGLE_MAPS_API_URL = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&v=weekly&region=IN&libraries=drawing,geometry,marker&loading=async`;

declare global {
  interface Window {
    google: any;
  }
}

interface MarkerData {
  lat: number;
  lng: number;
  company: string;
}

const IndiaMapView: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [map, setMap] = useState<any>(null);
  const markersRef = useRef<any[]>([]);

  // // Mock marker data
  // const markerData: MarkerData[] = [
  //   // IOCL markers (Red)
  //   { lat: 19.0760, lng: 72.8777, company: 'IOCL' }, // Mumbai
  //   { lat: 28.6139, lng: 77.2090, company: 'IOCL' }, // Delhi
  //   { lat: 12.9716, lng: 77.5946, company: 'IOCL' }, // Bangalore
  //   { lat: 22.5726, lng: 88.3639, company: 'IOCL' }, // Kolkata
    
  //   // HPCL markers (Blue)
  //   { lat: 19.0760, lng: 72.8777, company: 'HPCL' }, // Mumbai
  //   { lat: 13.0827, lng: 80.2707, company: 'HPCL' }, // Chennai
  //   { lat: 18.5204, lng: 73.8567, company: 'HPCL' }, // Pune
  //   { lat: 23.0225, lng: 72.5714, company: 'HPCL' }, // Ahmedabad
    
  //   // BPCL markers (Yellow)
  //   { lat: 19.0760, lng: 72.8777, company: 'BPCL' }, // Mumbai
  //   { lat: 28.6139, lng: 77.2090, company: 'BPCL' }, // Delhi
  //   { lat: 12.9716, lng: 77.5946, company: 'BPCL' }, // Bangalore
    
  //   // HMEL marker (Green)
  //   { lat: 13.0827, lng: 80.2707, company: 'HMEL' } // Chennai
  // ];

  const COMPANY_COLORS: Record<string, string> = {
    'IOCL': '#EF4444', // Red
    'HPCL': '#3B82F6', // Blue
    'BPCL': '#F59E0B', // Yellow
    'HMEL': '#10B981' // Green
  };

  useEffect(() => {
    if (window.google && window.google.maps) {
      initializeMap();
      return;
    }

    const script = document.createElement('script');
    script.src = GOOGLE_MAPS_API_URL;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      setIsLoaded(true);
      initializeMap();
    };

    script.onerror = () => {
      console.error('Failed to load Google Maps API');
    };

    document.head.appendChild(script);

    return () => {
      const existingScript = document.querySelector(`script[src="${GOOGLE_MAPS_API_URL}"]`);
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, []);

  const initializeMap = () => {
    if (!mapRef.current || !window.google || !window.google.maps) {
      return;
    }

    const defaultCenter = { lat: 20.5937, lng: 78.9629 };
    const defaultZoom = 5;

    const mapInstance = new window.google.maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom: defaultZoom,
      mapTypeId: 'satellite',
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: true,
      scaleControl: true,
      streetViewControl: false,
      rotateControl: false,
      fullscreenControl: false
    });

    setMap(mapInstance);

    // Add markers
    // markerData.forEach(markerInfo => {
    //   const marker = new window.google.maps.Marker({
    //     position: { lat: markerInfo.lat, lng: markerInfo.lng },
    //     map: mapInstance,
    //     title: markerInfo.company,
    //     icon: {
    //       path: window.google.maps.SymbolPath.CIRCLE,
    //       scale: 8,
    //       fillColor: COMPANY_COLORS[markerInfo.company] || '#999999',
    //       fillOpacity: 1,
    //       strokeColor: '#FFFFFF',
    //       strokeWeight: 2
    //     }
    //   });
    //   markersRef.current.push(marker);
    // });
  };

  const handleFullscreen = () => {
    if (mapRef.current) {
      if (mapRef.current.requestFullscreen) {
        mapRef.current.requestFullscreen();
      }
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full relative overflow-hidden">
      {/* Map Container */}
      <div
        ref={mapRef}
        className="w-full h-full"
        style={{ minHeight: '600px' }}
      />

      {/* Fullscreen Button */}
      <button
        onClick={handleFullscreen}
        className="absolute top-4 right-4 bg-white hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg shadow-md flex items-center gap-2 text-sm font-medium transition-colors z-10"
      >
        <Maximize2 className="w-4 h-4" />
        Fullscreen
      </button>

      {/* Live Status Legend */}
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm px-4 py-3 rounded-lg shadow-lg">
        <h4 className="text-sm font-semibold text-gray-800 mb-2">LIVE STATUS</h4>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-xs text-gray-700">IOCL</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-xs text-gray-700">HPCL</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-xs text-gray-700">BPCL</span>
          </div>
        </div>
      </div>

      {!isLoaded && !window.google && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-gray-600">Loading map...</div>
        </div>
      )}
    </div>
  );
};

export default IndiaMapView;
