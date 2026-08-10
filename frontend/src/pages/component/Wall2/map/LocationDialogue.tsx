import React, { useEffect, useRef, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/@/components/ui/sheet';
import { Button } from '@/@/components/ui/button';
import { Badge } from '@/@/components/ui/badge';
import { Building2, BarChart3, Users, X, Layers } from 'lucide-react';
import SalesDialog from './sales';

// Google Maps API Key
const GOOGLE_MAPS_API_KEY = 'AIzaSyDfMVbeSC78K1l78ZCsccs0WENDG6brfVc';
const GOOGLE_MAP_ID = (import.meta as any)?.env?.VITE_GOOGLE_MAP_ID || '';

interface LocationData {
  sap_id?: string;
  sbu?: string;
  zone?: string;
  state?: string;
  district?: string;
  city?: string;
  address?: string;
  region?: string;
  company?: string;
  type?: string;
  location_name?: string;
  name?: string;
  region_ppac?: string;
  'MS (KL)'?: number;
  'SKO (KL)'?: number;
  'HSD (KL)'?: number;
  'TOTAL (KL)'?: number;
  mode_of_receipt?: string;
  latitude?: number;
  longitude?: number;
  color_code?: string;
}

interface LocationDialogueProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: LocationData | null;
  mapStyle?: 'satellite' | 'vector';
}

const LocationDialogue: React.FC<LocationDialogueProps> = ({
  open,
  onOpenChange,
  location,
  mapStyle = 'vector',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isSalesDialogOpen, setIsSalesDialogOpen] = useState(false);
  const [salesDialogInitialTab, setSalesDialogInitialTab] = useState<'sales' | 'officers'>('sales');
  const [currentMapStyle, setCurrentMapStyle] = useState<'satellite' | 'roadmap'>('roadmap');

  // Get company badge color
  const getCompanyBadgeVariant = (company?: string) => {
    if (!company) return 'default';
    const companyUpper = company.toUpperCase();
    if (companyUpper === 'IOCL') return 'destructive'; // Red
    if (companyUpper === 'HPCL') return 'info2'; // Blue
    if (companyUpper === 'BPCL') return 'warning'; // Orange
    return 'default';
  };

  // Get SBU badge color
  const getSBUBadgeVariant = (sbu?: string) => {
    if (!sbu) return 'default';
    const sbuUpper = sbu.toUpperCase();
    if (sbuUpper === 'LPG') return 'info2'; // Blue
    if (sbuUpper === 'SOD') return 'info2'; // Blue
    return 'default';
  };

  // Initialize map for location view
  useEffect(() => {
    if (!open || !location) return;

    const lat = location.latitude;
    const lng = location.longitude;

    if (!lat || !lng) return;

    // Wait for dialog to be fully rendered and container to be available
    const initializeMap = () => {
      if (!mapContainerRef.current) {
        // Retry if container not ready
        requestAnimationFrame(initializeMap);
        return;
      }

      // Check if Google Maps is already loaded (from main map)
      if (!window.google || !window.google.maps) {
        // Wait a bit and retry if Google Maps is still loading
        const checkInterval = setInterval(() => {
          if (window.google && window.google.maps) {
            clearInterval(checkInterval);
            createMap();
          }
        }, 100);
        
        // Timeout after 5 seconds
        setTimeout(() => clearInterval(checkInterval), 5000);
        return;
      }

      createMap();
    };

    const createMap = () => {
      if (!mapContainerRef.current || !window.google?.maps) return;

      const google = window.google;
      
      // Clear existing map
      if (mapInstanceRef.current) {
        mapInstanceRef.current = null;
      }

      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        if (!mapContainerRef.current) return;

        try {
          const mapTypeId = currentMapStyle === 'satellite' 
            ? google.maps.MapTypeId.HYBRID 
            : google.maps.MapTypeId.ROADMAP;
          
          const map = new google.maps.Map(mapContainerRef.current, {
            center: { lat, lng },
            zoom: 15,
            mapTypeId: mapTypeId,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            zoomControl: true,
            gestureHandling: 'greedy',
            mapId: GOOGLE_MAP_ID || undefined,
          });

          // Add marker
          const marker = new google.maps.Marker({
            position: { lat, lng },
            map: map,
            title: location.location_name || location.name || 'Location',
          });

          mapInstanceRef.current = map;
          setMapLoaded(true);
        } catch (error) {
          console.error('Error initializing map in dialog:', error);
        }
      }, 50);
    };

    // Start initialization
    if (open) {
      // Use requestAnimationFrame to ensure dialog is rendered
      requestAnimationFrame(() => {
        initializeMap();
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current = null;
      }
    };
  }, [open, location, currentMapStyle]);

  // Update map type when currentMapStyle changes
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return;

    const map = mapInstanceRef.current;
    const google = window.google;

    if (currentMapStyle === 'satellite') {
      map.setMapTypeId(google.maps.MapTypeId.HYBRID);
    } else {
      map.setMapTypeId(google.maps.MapTypeId.ROADMAP);
    }
  }, [currentMapStyle]);

  // Toggle map style function
  const toggleMapStyle = () => {
    setCurrentMapStyle(prev => prev === 'satellite' ? 'roadmap' : 'satellite');
  };

  if (!location) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-full w-full overflow-hidden p-0 h-full">
        <div className="flex flex-col lg:flex-row h-full">
          {/* Left Section - Map */}
          <div className="w-full lg:w-[70%] border-r border-gray-200 h-full">
            <div className="h-full w-full relative bg-gray-100">
              <div ref={mapContainerRef} className="w-full h-full absolute inset-0" />
              {!mapLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="text-sm text-gray-500">Loading map...</div>
                </div>
              )}
              
              {/* Map Style Toggle Button */}
              {mapLoaded && (
                <Button
                  onClick={toggleMapStyle}
                  className="absolute top-4 right-4 z-10 bg-white hover:bg-gray-100 text-gray-700 shadow-lg border border-gray-200"
                  size="icon"
                  variant="outline"
                  title={currentMapStyle === 'satellite' ? 'Switch to Road View' : 'Switch to Satellite View'}
                >
                  <Layers className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Right Section - Details */}
          <div className="w-full lg:w-[30%] p-4 overflow-y-auto">
            <SheetHeader className="mb-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Building2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <SheetTitle className="text-2xl font-bold text-gray-900">
                      {location.location_name || location.name || 'Location'}
                    </SheetTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      LOCATION ID: {location.sap_id || '-'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </SheetHeader>

            {/* General Information Cards */}
            <div className="mb-3">
              <div className="grid grid-cols-2 gap-2">
                {/* SBU Card */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                  <div className="h-0.5 bg-red-500"></div>
                  <div className="p-1.5">
                    <div className="text-base font-bold text-gray-900 mb-0.5">
                      {location.sbu || '-'}
                    </div>
                    <div className="text-[10px] font-semibold text-blue-600 uppercase">
                      SBU
                    </div>
                  </div>
                </div>

                {/* ZONE Card */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                  <div className="h-0.5 bg-red-500"></div>
                  <div className="p-1.5">
                    <div className="text-base font-bold text-gray-900 mb-0.5">
                      {location.zone || '-'}
                    </div>
                    <div className="text-[10px] font-semibold text-blue-600 uppercase">
                      ZONE
                    </div>
                  </div>
                </div>

                {/* SAP ID Card */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                  <div className="h-0.5 bg-orange-500"></div>
                  <div className="p-1.5">
                    <div className="text-base font-bold text-gray-900 mb-0.5">
                      {location.sap_id || '-'}
                    </div>
                    <div className="text-[10px] font-semibold text-blue-600 uppercase">
                      SAP ID
                    </div>
                  </div>
                </div>

                {/* COMPANY Card */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                  <div className="h-0.5 bg-orange-500"></div>
                  <div className="p-1.5">
                    <div className="text-base font-bold text-gray-900 mb-0.5">
                      {location.company || '-'}
                    </div>
                    <div className="text-[10px] font-semibold text-blue-600 uppercase">
                      COMPANY
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Location Details Card */}
            <div className="mb-3">
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="h-0.5 bg-blue-500"></div>
                <div className="p-3">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">LOCATION DETAILS</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs text-gray-500 block mb-1">State</span>
                      <span className="text-sm font-medium">{location.state || '-'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block mb-1">District</span>
                      <span className="text-sm font-medium">{location.district || '-'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block mb-1">City</span>
                      <span className="text-sm font-medium">{location.city || '-'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block mb-1">Region</span>
                      <span className="text-sm font-medium">{location.region || location.region_ppac || '-'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs text-gray-500 block mb-1">Address</span>
                      <span className="text-sm font-medium">{location.address || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Operational Capacity Card */}
            <div className="mb-3">
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="h-0.5 bg-green-500"></div>
                <div className="p-3">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">OPERATIONAL CAPACITY</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs text-gray-500 block mb-1">MS (KL)</span>
                      <span className="text-sm font-medium">{location['MS (KL)'] || '-'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block mb-1">SKO (KL)</span>
                      <span className="text-sm font-medium">{location['SKO (KL)'] || '-'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block mb-1">HSD (KL)</span>
                      <span className="text-sm font-medium">{location['HSD (KL)'] || '-'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block mb-1">TOTAL (KL)</span>
                      <span className="text-sm font-medium font-semibold text-black-600">
                        {location['TOTAL (KL)'] || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block mb-1">Supply Mode</span>
                      <span className="text-sm font-medium">{location.mode_of_receipt || '-'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block mb-1">Type</span>
                      <span className="text-sm font-medium">{location.type || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons - Only show for HPCL */}
            {location.company?.toUpperCase() === 'HPCL' && (
              <div className="flex gap-3 pt-3 border-t border-gray-200">
                <Button
                  variant="default"
                  className="flex-1 bg-green-600 mt-5 hover:bg-green-700 text-white"
                  onClick={() => {
                    setSalesDialogInitialTab('sales');
                    setIsSalesDialogOpen(true);
                  }}
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Sales Data
                </Button>
                <Button
                  variant="default"
                  className="flex-1 bg-orange-600  mt-5 hover:bg-orange-700 text-white"
                  onClick={() => {
                    setSalesDialogInitialTab('officers');
                    setIsSalesDialogOpen(true);
                  }}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Plant Officers
                </Button>
              </div>
            )}
          </div>
        </div>
      </SheetContent>

      {/* Sales Dialog with dynamic initial tab */}
      <SalesDialog
        open={isSalesDialogOpen}
        onOpenChange={setIsSalesDialogOpen}
        location={location}
        initialTab={salesDialogInitialTab}
      />
    </Sheet>
  );
};

export default LocationDialogue;
