import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/@/lib/utils";
import { Button } from "@/@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/@/components/ui/popover";
import { apiClient } from '@/services/apiClient';

interface LocationFilterProps {
  bu: string;
  zone?: string | null;
  sapid?: string | null;
  onZoneChange?: (zone: string | null) => void;
  onPlantChange?: (plant: string | null, zone: string | null) => void;
  onAlertTypeChange?: (alertType: string) => void;
  hideAlertType?: boolean;
  defaultZone?: string;
  defaultPlant?: string;
  hideZone?: boolean;
  hidePlant?: boolean;
}

interface SelectOption {
  name: string;
  id: string;
}

const TerminalAutomationZonePlantSelections: React.FC<LocationFilterProps> = ({
  bu,
  zone,
  sapid,
  onZoneChange,
  onPlantChange,
  defaultZone,
  defaultPlant,
  onAlertTypeChange,
  hideAlertType = false,
  hideZone = false,
  hidePlant = false,
}) => {
  const [zoneData, setZoneData] = useState<SelectOption[]>([]);
  const [plantData, setPlantData] = useState<SelectOption[]>([]);
  const [alertTypes, setAlertTypes] = useState<string[]>([]);
  
  // Prioritize defaultZone in the initial state if no zone is provided
  const [selectedZone, setSelectedZone] = useState<string>(zone || defaultZone || "");
  const [selectedPlant, setSelectedPlant] = useState<string>(sapid || "");
  const [selectedAlertType, setSelectedAlertType] = useState<string>("");
  
  const [openZone, setOpenZone] = useState(false);
  const [openPlant, setOpenPlant] = useState(false);
  const [openAlertType, setOpenAlertType] = useState(false);
  
  // Cache for zones and plants data to avoid redundant API calls
  const zoneDataCache = useRef<{[key: string]: SelectOption[]}>({
    all: [] // Cache for all zones
  });
  const plantDataCache = useRef<{[key: string]: SelectOption[]}>({
    all: [] // Cache for all plants
  });
  
  // A ref to track if we need to force a reset of internal state
  const isInitialMount = useRef(true);
  const isZoneChanging = useRef(false);
  // Track if the user has manually selected a zone different from default
  const userSelectedZone = useRef(false);
  // Track if zone data has been fetched initially
  const allZonesDataFetched = useRef(false);

  /** Bumped on unmount so async init / fetchPlantData cannot notify parent after this instance is gone (avoids stale NCZ/1128 on other tabs). */
  const mountedGeneration = useRef(0);

  // Single initialization effect for initial data load
  useEffect(() => {
    const gen = ++mountedGeneration.current;

    const initializeComponent = async () => {
      console.log("Initial mount with defaultZone:", defaultZone);
      
      // Clear localStorage
      localStorage.removeItem("zone");
      localStorage.removeItem("sapId");
      
      // Fetch alert types if needed
      if (!hideAlertType) {
        fetchAlertTypes();
      }
      
      // Always set a defaultZone if available
      if (defaultZone) {
        console.log("Setting defaultZone:", defaultZone);
        
        // Set selected zone immediately
        setSelectedZone(defaultZone);
        
        // Store in localStorage if valid
        if (defaultZone !== "all") {
          localStorage.setItem('zone', defaultZone);
        }
        
        // Notify parent components that this zone is selected
        const zoneValue = defaultZone === "all" ? null : defaultZone;
        onZoneChange?.(zoneValue);
        
        // Fetch initial zone data - will cache it for later use
        await fetchInitialZoneData(bu);
        if (mountedGeneration.current !== gen) return;
        
        // Then, fetch the plant data based on the selected zone
        if (defaultZone === "all") {
          // For "all" zones, get all plants
          await fetchPlantData(bu, "all");
        } else {
          // For specific zone, fetch zone-specific plants
          await fetchPlantData(bu, defaultZone);
        }
        if (mountedGeneration.current !== gen) return;
        
        // Only set defaultPlant if we're using defaultZone
        if (defaultPlant) {
          console.log("Setting up defaultPlant with defaultZone:", defaultPlant);
          setSelectedPlant(defaultPlant);
          
          // Store in localStorage if valid
          if (defaultPlant !== "all") {
            localStorage.setItem('sapId', defaultPlant);
          }
          
          if (mountedGeneration.current !== gen) return;
          // Notify parent about both zone and plant
          const plantValue = defaultPlant === "all" ? null : defaultPlant;
          onPlantChange?.(plantValue, zoneValue);
        }
      } else {
        // No defaultZone, fetch all zone data
        await fetchInitialZoneData(bu);
        if (mountedGeneration.current !== gen) return;
        // Also fetch all plants
        await fetchPlantData(bu, "all");
      }
    };
    
    // Only run on initial mount
    if (isInitialMount.current) {
      initializeComponent();
      isInitialMount.current = false;
    }

    return () => {
      mountedGeneration.current++;
    };
  }, []);  // Empty dependency array to ensure it only runs once

  // Handle defaultPlant only after we have plant data and only if current zone matches defaultZone
  useEffect(() => {
    // Only apply defaultPlant when: 
    // 1. We have a defaultPlant
    // 2. We have plant data
    // 3. The selected zone matches the defaultZone
    // 4. User hasn't manually selected a different zone
    if (defaultPlant && plantData.length > 0 && 
        selectedZone === defaultZone && 
        !userSelectedZone.current) {
      
      // Only set if different from current selection to avoid loops
      if (defaultPlant !== selectedPlant) {
        console.log("Setting defaultPlant because zone matches defaultZone:", defaultPlant);
        setSelectedPlant(defaultPlant);
        
        // Store in localStorage if valid
        if (defaultPlant !== "all") {
          localStorage.setItem('sapId', defaultPlant);
        }
        
        // Notify parent component
        const zoneValue = selectedZone === "all" ? null : selectedZone;
        const plantValue = defaultPlant === "all" ? null : defaultPlant;
        onPlantChange?.(plantValue, zoneValue);
      }
    }
  }, [plantData, defaultPlant, selectedZone, defaultZone]);

  // Handle external zone changes from props
  useEffect(() => {
    // Skip if we're already handling a zone change internally
    if (isZoneChanging.current) {
      isZoneChanging.current = false;
      return;
    }
    
    // Skip during initial mount (handled by first effect)
    if (isInitialMount.current) {
      return;
    }

    // Handle meaningful changes in zone prop
    if (zone !== undefined && zone !== selectedZone) {
      console.log("External zone change detected:", zone);
      
      // Reset case
      if (zone === null) {
        setSelectedZone("");
        setSelectedPlant("");
        setPlantData([]);
        userSelectedZone.current = true; // Mark as user-selected to avoid defaultPlant
        
        // Use cached zone data if available
        if (zoneDataCache.current.all && zoneDataCache.current.all.length > 0) {
          console.log("Using cached zone data for reset case");
          const allOption = { id: "all", name: "All Zones" };
          setZoneData([allOption, ...zoneDataCache.current.all]);
        } else {
          // Otherwise fetch it
          fetchInitialZoneData(bu);
        }
      } 
      // Normal zone change
      else {
        setSelectedZone(zone);
        // Mark as an external change (not user manually selecting)
        userSelectedZone.current = false;
        
        // No need to fetch zone data again, just fetch plant data for the selected zone
        fetchPlantData(bu, zone);
      }
    }
  }, [zone, bu]);

  const fetchAlertTypes = async () => {
    try {
      const response = await apiClient.post('/api/charts/get_distinct_values', {
        connection_id: 1,
        schema: "public",
        table: "alerts",
        column: ["interlock_name"],
        where_cond: [
          {
            key: "alert_section",
            cond: "=",
            value: "VA"
          },
          {
            key: "bu",
            cond: "=",
            value: bu
          },
          {
            key: "alert_status",
            cond: "=",
            value: "Open"
          },
          {
            key: "interlock_name",
            cond: "!=",
            value: ""
          }
        ]
      });

      if (response?.data?.status) {  
        // Sort the interlock_name values alphabetically
        const sortedTypes = response.data.data.interlock_name.sort((a: string, b: string) => 
          a.localeCompare(b, undefined, { sensitivity: 'base' })
        );
        const types = ["all", ...sortedTypes];
        setAlertTypes(types);
      }
    } catch (error) {
      console.error("Error fetching alert types:", error);
    }
  };

  // Fetch initial zone data once and cache it
  const fetchInitialZoneData = async (bu: string) => {
    console.log("Fetching and caching all zones data (should happen only once)");
    
    // Skip if already fetched
    if (allZonesDataFetched.current && zoneDataCache.current.all.length > 0) {
      console.log("Using cached zone data - already fetched");
      const allOption = { id: "all", name: "All Zones" };
      setZoneData([allOption, ...zoneDataCache.current.all]);
      return;
    }
    
    try {
      // Make the "All Zones" API call to get and cache all zones
      const allZonesPayload = {
        bu,
        zone: "", // Empty to get all zones
        plant: "",
        location_onboard: true
      };
      
      console.log("Initial Zones API payload:", allZonesPayload);
      const allZonesResponse = await apiClient.post('/api/locationmaster/get_dist_loc_details', allZonesPayload);
      
      // Process zones from the response
      const allOption = { id: "all", name: "All Zones" };
      let allZones: SelectOption[] = [];
      
      if (allZonesResponse?.data?.status === true && allZonesResponse.data.data?.zone) {
        console.log("All Zones API Response:", allZonesResponse.data);
        allZones = [...allZonesResponse.data.data.zone];
        
        // Make sure default zone exists in the list if provided
        if (defaultZone && defaultZone !== "all" && !allZones.some(z => z.id === defaultZone)) {
          console.log("Adding default zone to zones list");
          allZones.push({ id: defaultZone, name: `Zone ${defaultZone}` });
        }
        
        // Sort zones alphabetically
        const sortedZones = [...allZones].sort((a, b) => 
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        );
        
        // Cache the sorted zones
        zoneDataCache.current.all = sortedZones;
        
        // Mark as fetched
        allZonesDataFetched.current = true;
        
        // Set in state with the "All Zones" option
        setZoneData([allOption, ...sortedZones]);
      }
      
      // Also cache all plants if available
      if (allZonesResponse?.data?.status === true && allZonesResponse.data.data?.sap_id) {
        console.log("Caching all plants data");
        let allPlants = [...allZonesResponse.data.data.sap_id];
        
        // Sort plants alphabetically
        const sortedPlants = [...allPlants].sort((a, b) => 
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        );
        
        // Cache the sorted plants
        plantDataCache.current.all = sortedPlants;
      }
    } catch (error) {
      console.error("Error fetching initial zone data:", error);
    }
  };
  
  const getCachedPlantsForZone = (zone: string): SelectOption[] | null => {
    if (zone === "all") {
      return plantDataCache.current.all.length > 0
        ? plantDataCache.current.all
        : null;
    }

    if (plantDataCache.current[zone]?.length > 0) {
      return plantDataCache.current[zone];
    }

    const matchKey = Object.keys(plantDataCache.current).find(
      (key) => key !== "all" && key.toLowerCase() === zone.toLowerCase()
    );

    return matchKey && plantDataCache.current[matchKey]?.length > 0
      ? plantDataCache.current[matchKey]
      : null;
  };

  // Fetch plant data for a specific zone (or all plants if zone is "all")
  const fetchPlantData = async (bu: string, zone: string) => {
    console.log(`Fetching plant data for zone: ${zone}`);
    
    const cachedPlants = getCachedPlantsForZone(zone);
    if (cachedPlants) {
      console.log(`Using cached plant data for zone: ${zone}`);
      const allPlantsOption = { id: "all", name: "All Plants" };
      setPlantData([allPlantsOption, ...cachedPlants]);
      handlePlantSelection(cachedPlants, zone);
      return;
    }
    
    try {
      const genAtStart = mountedGeneration.current;
      // Make the API call based on zone selection
      const payload = {
        bu,
        zone: zone === "all" ? "" : zone,
        plant: "",
        location_onboard: true
      };
      
      console.log("Plant data API payload:", payload);
      const response = await apiClient.post('/api/locationmaster/get_dist_loc_details', payload);
      
      // Process plants from the response
      let sortedPlants: SelectOption[] = [];
      
      if (response?.data?.status === true && response.data.data?.sap_id) {
        console.log("Plant data API Response:", response.data);
        const plants = [...response.data.data.sap_id];
        
        const filteredPlants = plants.filter((p) => p.id !== "all");
        sortedPlants = [...filteredPlants].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        );
        
        if (zone === "all") {
          plantDataCache.current.all = sortedPlants;
        } else {
          plantDataCache.current[zone] = sortedPlants;
        }
        
        const allPlantsOption = { id: "all", name: "All Plants" };
        setPlantData([allPlantsOption, ...sortedPlants]);
      } else {
        const allPlantsOption = { id: "all", name: "All Plants" };
        setPlantData([allPlantsOption]);
      }
      
      if (mountedGeneration.current !== genAtStart) return;
      handlePlantSelection(sortedPlants, zone);
    } catch (error) {
      console.error("Error fetching plant data:", error);
    }
  };
  
  // Helper function to set plant selection based on current rules
  const handlePlantSelection = (
    plantsForZone: SelectOption[] = [],
    zone: string = selectedZone
  ) => {
    const zoneValue = zone === "all" ? null : zone;

    if (defaultPlant && zone === defaultZone && !userSelectedZone.current) {
      setSelectedPlant(defaultPlant);
      const plantValue = defaultPlant === "all" ? null : defaultPlant;
      onPlantChange?.(plantValue, zoneValue);
      return;
    }

    // Auto-select when API returns exactly one plant for the zone (not hardcoded).
    if (zone !== "all" && plantsForZone.length === 1) {
      const singlePlant = plantsForZone[0];
      setSelectedPlant(singlePlant.id);
      localStorage.setItem("sapId", singlePlant.id);
      onPlantChange?.(singlePlant.id, zoneValue);
      return;
    }

    setSelectedPlant("all");
    onPlantChange?.(null, zoneValue);
  };

  const handleZoneChange = async (value: string) => {
    console.log("Zone changed to:", value);
    
    // Set the flag to prevent duplicate API calls from the zone useEffect
    isZoneChanging.current = true;
    
    // Skip if already selected to prevent loops
    if (value === selectedZone) {
      return;
    }
    
    // Mark as a user-initiated zone change
    userSelectedZone.current = true;
    
    // Update selected zone in state
    setSelectedZone(value);
    
    // Reset plant selection
    setSelectedPlant("all");
    
    // Update localStorage
    if (value === "all") {
      localStorage.removeItem("zone");
    } else {
      localStorage.setItem("zone", value);
    }
    
    // Also reset plant selection in localStorage
    localStorage.removeItem("sapId");
    
    // Notify parent component about zone change (parent clears plant in one batch to avoid double chart API call)
    const zoneValue = value === "all" ? null : value;
    onZoneChange?.(zoneValue);

    // No need to fetch zone data again, just fetch plant data for the selected zone
    await fetchPlantData(bu, value);
  };

  const handlePlantChange = (value: string) => {
    // Skip if already selected to prevent loops
    if (value === selectedPlant) {
      return;
    }
    
    setSelectedPlant(value);
    
    // Update localStorage
    if (value === "all") {
      localStorage.removeItem("sapId");
    } else {
      localStorage.setItem("sapId", value);
    }
    
    // Notify parent component about plant change
    const plantValue = value === "all" ? null : value;
    const zoneValue = selectedZone === "all" ? null : selectedZone;
    onPlantChange?.(plantValue, zoneValue);
  };

  // Helper to get display name for the selected zone
  const getSelectedZoneDisplayName = () => {
    if (!selectedZone) {
      return "Select Zone";
    }
    const zone = zoneData.find((zone) => zone.id === selectedZone);
    return zone ? zone.name : "Select Zone";
  };

  // Helper to get display name for the selected plant
  const getSelectedPlantDisplayName = () => {
    if (!selectedPlant) {
      return "Select Plant";
    }
    if (selectedPlant === "all") {
      return "All Plants";
    }
    const plant = plantData.find((plant) => plant.id === selectedPlant);
    return plant ? plant.name : "Select Plant";
  };

  return (
    <div className="flex gap-1">
      {!hideZone && (
        <Popover open={openZone} onOpenChange={setOpenZone}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={openZone}
              className="w-42 h-7 min-w-0 max-w-full overflow-hidden text-xs justify-between gap-1"
              data-selected-zone={selectedZone}
            >
              <span className="min-w-0 flex-1 truncate text-left font-normal">
                {getSelectedZoneDisplayName()}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-42 p-0">
            <Command>
              <CommandInput placeholder="Search Zone..." className="h-9" />
              <CommandList>
                <CommandEmpty>No zone found.</CommandEmpty>
                <CommandGroup>
                  {zoneData.map((zone) => (
                    <CommandItem
                      key={zone.id}
                      value={zone.name.toLowerCase()}
                      onSelect={() => {
                        handleZoneChange(zone.id);
                        setOpenZone(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedZone === zone.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {zone.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}

      {!hidePlant && (
        <Popover open={openPlant} onOpenChange={setOpenPlant}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={openPlant}
              className="w-42 h-7 min-w-0 max-w-full overflow-hidden text-xs justify-between gap-1"
              data-selected-plant={selectedPlant}
              // Only disable when there's no plant data
              disabled={plantData.length === 0}
            >
              <span className="min-w-0 flex-1 truncate text-left font-normal">
                {getSelectedPlantDisplayName()}
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
                  {plantData.map((plant) => {
                    // Skip if duplicate "all" option (should only be first one)
                    if (plant.id === "all" && plantData.findIndex(p => p.id === "all") !== plantData.indexOf(plant)) {
                      return null;
                    }
                    return (
                      <CommandItem
                        key={plant.id}
                        value={plant.id === "all" ? "all plants" : plant.name.toLowerCase()}
                        onSelect={() => {
                          handlePlantChange(plant.id);
                          setOpenPlant(false);
                        }}
                      >
                        <Check
                          className={cn( 
                            "mr-2 h-4 w-4",
                            selectedPlant === plant.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {plant.name}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};

export default TerminalAutomationZonePlantSelections;