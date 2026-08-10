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
import useAuthStore from "@/store/authStore";

interface LocationFilterProps {
  bu: string;
  zone?: string | null; // Modified to accept null
  sapid?: string | null; // Modified to accept null
  containerClassName?: string;
  onZoneChange?: (zone: string | null) => void;
  onPlantChange?: (plant: string | null, zone: string | null) => void;
  onPlantDisplayNameChange?: (plantName: string | null) => void;
  onAlertTypeChange?: (alertType: string) => void;
  hideAlertType?: boolean;
  defaultZone?: string;
  defaultPlant?: string;
  /** Match plant display name (case-insensitive) once location list loads; selects sap_id for payloads. */
  defaultPlantName?: string;
  hideZone?: boolean;
  hidePlant?: boolean;
  sendEmptyBu?: boolean; // Add prop to send empty bu in API calls
}

interface SelectOption {
  name: string;
  id: string;
}

const ZonePlantSelections: React.FC<LocationFilterProps> = ({
  bu,
  zone,
  sapid,
  containerClassName,
  onZoneChange,
  onPlantChange,
  onPlantDisplayNameChange,
  defaultZone,
  defaultPlant,
  defaultPlantName,
  onAlertTypeChange,
  hideAlertType = false,
  hideZone = false,
  hidePlant = false,
  sendEmptyBu = false, // Default to false
}) => {
  const authUser = useAuthStore((state) => state.user);

  const [zoneData, setZoneData] = useState<SelectOption[]>([]);
  const [plantData, setPlantData] = useState<SelectOption[]>([]);
  const [alertTypes, setAlertTypes] = useState<string[]>([]);
  
  const [selectedZone, setSelectedZone] = useState<string>(zone || defaultZone || "");
  const [selectedPlant, setSelectedPlant] = useState<string>(defaultPlant || "");
  const [selectedAlertType, setSelectedAlertType] = useState<string>("");

  const [openZone, setOpenZone] = useState(false);
  const [openPlant, setOpenPlant] = useState(false);
  const [openAlertType, setOpenAlertType] = useState(false);
    const [resetTrigger, setResetTrigger] = useState(0);
  
  // A ref to track if we need to force a reset of internal state
  const prevZoneRef = useRef(zone);
  const prevSapidRef = useRef(sapid);

  const fetchingRef = useRef(false);
  const lastFetchParamsRef = useRef<string>('');
  const defaultPlantNameAppliedRef = useRef(false);

  // Fetch initial data on component mount or when BU changes
  useEffect(() => {
    lastFetchParamsRef.current = '';
    fetchInitialData(bu);
    fetchAlertTypes();
  }, [bu]);
  useEffect(() => {
    localStorage.removeItem("zone") // Replace with your actual key
  }, [])
  useEffect(() => {
    localStorage.removeItem("sapId") // Replace with your actual key
  }, [])
  // Update selectedZone when zone prop changes
  useEffect(() => {
    // Check if zone is null or undefined (reset case)
    if (zone === null || zone === undefined) {
      setSelectedZone("");
      // Also reset the plant data when zone is reset
      setSelectedPlant("");
      lastFetchParamsRef.current = '';
      // Fetch initial data to reset the dropdowns
      fetchInitialData(bu);
    }
    // Normal zone change
    else if (zone && zone !== selectedZone) {
      setSelectedZone(zone);
      // Fetch plant data for the new zone
      if (zone !== "all") {
        fetchFilteredPlantData(bu, zone);
      }
    }
    // Update the ref
    prevZoneRef.current = zone;
  }, [zone, bu]);
  useEffect(() => {
    if (resetTrigger > 0) {
        // Reset internal state of zone and plant selections
        setSelectedZone(null);
        setSelectedPlant(null);
        // If you have any other internal state, reset it here
    }
}, [resetTrigger]);
  // Update selectedPlant when sapid prop changes
  useEffect(() => {
    // Check if sapid is null or undefined (reset case)
    let sap_id = localStorage.getItem('sapId');
    let zone = localStorage.getItem('zone');
    if(sap_id && zone) {
      setSelectedPlant(sap_id);
      setSelectedZone(zone);
    }
    // if (sapid === null || sapid === undefined) {
    //   setSelectedPlant("");
    // }
    // else if (sapid !== selectedPlant) {
    //   setSelectedPlant(sapid);
    // }

    // Update the ref
    // prevSapidRef.current = sapid;
  }, [sapid]);
  
// Current useEffect
useEffect(() => {
  if (defaultZone && defaultZone !== selectedZone && zoneData.length > 0) {
    setSelectedZone(defaultZone);
    handleZoneChange(defaultZone);
  }
}, [defaultZone, zoneData, ]);
useEffect(() => {
  // Only use defaultZone if we don't have a user selection or localStorage value
  const storedZone = localStorage.getItem('zone');
  if (!storedZone && !selectedZone && defaultZone && zoneData.length > 0) {
    setSelectedZone(defaultZone);
    // Only call handleZoneChange if this is an initial setup
    if (zoneData.length > 0 && !prevZoneRef.current) {
      handleZoneChange(defaultZone);
    }
  }
}, [defaultZone, zoneData, selectedZone]);
  // Update for defaultPlant
  useEffect(() => {
    if (defaultPlant && defaultPlant !== selectedPlant) {
      setSelectedPlant(defaultPlant);
      // If we have both a default plant and zone, pass both to parent
      if (selectedZone) {
        onPlantChange?.(defaultPlant, selectedZone);
      }
    }
  }, [defaultPlant, selectedZone]);

  // Auto-select zone when authUser has exactly one zone and zone data is loaded
  useEffect(() => {
    if (
      authUser?.zone &&
      authUser.zone.length === 1 &&
      zoneData.length > 1 &&
      !selectedZone
    ) {
      const autoZone = String(authUser.zone[0]);
      const matchedZone = zoneData.find((z) => z.id === autoZone);
      if (matchedZone) {
        setSelectedZone(autoZone);
        onZoneChange?.(autoZone);
        fetchFilteredPlantData(bu, autoZone);
      }
    }
  }, [authUser, zoneData]);

  // Default plant by display name (e.g. Coimbatore) once locations are loaded
  useEffect(() => {
    const hasPlants = plantData.some((p) => p.id !== 'all');
    if (!defaultPlantName || defaultPlantNameAppliedRef.current || !hasPlants) return;
    const target = defaultPlantName.trim().toLowerCase();
    if (!target) return;
    const exact = plantData.find(
      (p) => p.id !== 'all' && p.name.trim().toLowerCase() === target
    );
    const matched =
      exact ??
      plantData.find(
        (p) => p.id !== 'all' && p.name.trim().toLowerCase().includes(target)
      );
    if (!matched) return;
    defaultPlantNameAppliedRef.current = true;
    localStorage.setItem('sapId', matched.id);
    setSelectedPlant(matched.id);
    const zoneValue = selectedZone === 'all' || !selectedZone ? null : selectedZone;
    onPlantChange?.(matched.id, zoneValue);
    onPlantDisplayNameChange?.(matched.name);
  }, [defaultPlantName, plantData, selectedZone]);

  // Auto-select sap_id when authUser has exactly one sap_id and plant data is loaded
  useEffect(() => {
    if (defaultPlantName) return;
    if (
      authUser?.sap_id &&
      authUser.sap_id.length === 1 &&
      plantData.length > 1 &&
      !selectedPlant
    ) {
      const autoSapId = String(authUser.sap_id[0]);
      const matchedPlant = plantData.find((p) => p.id === autoSapId);
      if (matchedPlant) {
        setSelectedPlant(autoSapId);
        const zoneValue = selectedZone === "all" || !selectedZone ? null : selectedZone;
        onPlantChange?.(autoSapId, zoneValue);
        onPlantDisplayNameChange?.(matchedPlant.name);
      }
    }
  }, [authUser, plantData]);

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

  const fetchInitialData = async (bu: string) => {
    try {
      const payload = {
        bu: sendEmptyBu ? [""] : [bu],
        zone: [""],
        region: [""],
        sales_area: [""],
        sap_id: [""],
      };

      const fetchKey = `initial-${sendEmptyBu ? "empty" : bu}`;

      // If we're already fetching or just fetched with the same params, skip
      if (fetchingRef.current || lastFetchParamsRef.current === fetchKey) {
        return;
      }

      fetchingRef.current = true;
      lastFetchParamsRef.current = fetchKey;

      const response = await apiClient.post('/api/ticketing/get_location_data', payload);
      if (response?.data?.status === true) {
        if (response.data.data?.zones) {
          const allOption = { id: "all", name: "All Zones" };
          const sortedZones = [...response.data.data.zones].sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: 'base' })
          ).map(zone => ({ id: zone, name: zone }));
          setZoneData([allOption, ...sortedZones]);
        }
        if (response.data.data?.locations) {
          const allOption = { id: "all", name: "All Plants" };
          const sortedPlants = [...response.data.data.locations]
            .map(location => ({
              id: location.sap_id,  // Use sap_id as the id
              name: location.name    // Use name for display
            }))
            .sort((a, b) =>
              a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
            );
          setPlantData([allOption, ...sortedPlants]);
        }
      }
    } catch (error) {
      console.error("Error fetching initial data:", error);
    } finally {
      fetchingRef.current = false;
    }
  };
  
  const fetchFilteredPlantData = async (bu: string, zone: string) => {
    try {
      // Pass selected zone in payload so API returns only plants (sap_id) for that zone
      const payload = {
        bu: sendEmptyBu ? [""] : [bu],
        zone: zone ? [zone] : [""],
        region: [""],
        sales_area: [""],
        sap_id: [""],
      };

      // Create a unique key for this API call to detect duplicates
      const fetchKey = `filtered-${sendEmptyBu ? "empty" : bu}-${zone}`;

      // If we're already fetching or just fetched with the same params, skip
      if (fetchingRef.current || lastFetchParamsRef.current === fetchKey) {
        return;
      }

      fetchingRef.current = true;
      lastFetchParamsRef.current = fetchKey;

      const response = await apiClient.post('/api/ticketing/get_location_data', payload);

      if (response?.data?.status === true && response.data.data?.locations) {
        const allOption = { id: "all", name: "All Plants" };
        // Transform and sort plant data (sap_id) alphabetically by name
        const sortedPlants = [...response.data.data.locations]
          .map((location: { sap_id: string; name?: string }) => ({
            id: location.sap_id,
            name: location.name ?? location.sap_id
          }))
          .sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
          );
        setPlantData([allOption, ...sortedPlants]);
      } else {
        setPlantData([{ id: "all", name: "All Plants" }]);
      }
    } catch (error) {
      console.error("Error fetching plant data:", error);
      setPlantData([{ id: "all", name: "All Plants" }]);
    } finally {
      fetchingRef.current = false;
    }
  };

  const handleZoneChange = async (value: string) => {
    // Save to localStorage first
    if (value === "all") {
      localStorage.removeItem("zone");
    } else {
      localStorage.setItem("zone", value);
    }

    setSelectedZone(value);
    
    // Reset plant selection when zone changes
    setSelectedPlant("");
    localStorage.removeItem("sapId");
    
    // Immediately pass the zone ID to parent component
    const zoneValue = value === "all" ? null : value;
    onZoneChange?.(zoneValue);
  
    // Also reset the plant selection in the parent component
    onPlantChange?.(null, zoneValue);
    onPlantDisplayNameChange?.(null);
  
    // Make sure we're using the newly selected value for API calls
    if (value && value !== "all") {
      await fetchFilteredPlantData(bu, value);
    } else {
      await fetchInitialData(bu);
    }
  };

  const handlePlantChange = (value: string) => {
    // Save to localStorage first
    if (value === "all") {
      localStorage.removeItem("sapId");
    } else {
      localStorage.setItem("sapId", value);
    }

    setSelectedPlant(value);

    const plantValue = value === "all" ? null : value;
    const zoneValue = selectedZone === "all" ? null : selectedZone;
    const selectedPlantOption = plantData.find((plant) => plant.id === value);
    const plantDisplayName = value === "all" ? null : (selectedPlantOption?.name ?? null);

    onPlantChange?.(plantValue, zoneValue);
    onPlantDisplayNameChange?.(plantDisplayName);
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
    const plant = plantData.find((plant) => plant.id === selectedPlant);
    return plant ? plant.name : "Select Plant";
  };

  return (
    <div className={containerClassName ?? "w-full flex gap-1 justify-end"}>
      {!hideZone && (
        <Popover open={openZone} onOpenChange={setOpenZone}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={openZone}
              className="flex h-7 w-44 min-w-44 items-center justify-between gap-1.5 pl-2.5 pr-2 text-left text-[11px] leading-snug font-normal"
              data-selected-zone={selectedZone} // For debugging in DOM
            >
              <span className="min-w-0 flex-1 truncate text-left">{getSelectedZoneDisplayName()}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="min-w-44 w-max max-w-[min(100vw-1.5rem,22rem)] p-0"
            align="end"
          >
            <Command>
              <CommandInput placeholder="Search Zone..." className="h-9" />
              <CommandList>
                <CommandEmpty>No zone found.</CommandEmpty>
                <CommandGroup>
                  {zoneData.map((zone) => (
                    <CommandItem
                      key={zone.id}
                      value={zone.name.toLowerCase()}
                      className="gap-2 text-left text-[11px] items-start"
                      onSelect={() => {
                        handleZoneChange(zone.id);
                        setOpenZone(false);
                      }}
                    >
                      <span
                        className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center"
                        aria-hidden
                      >
                        <Check
                          className={cn(
                            "h-3.5 w-3.5 shrink-0",
                            selectedZone === zone.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                      </span>
                      <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug">
                        {zone.name}
                      </span>
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
              className="flex h-7 w-44 min-w-44 items-center justify-between gap-1.5 pl-2.5 pr-2 text-left text-[11px] leading-snug font-normal"
              data-selected-plant={selectedPlant} // For debugging in DOM
              // Disable plant selection if no zone is selected
              disabled={!selectedZone && plantData.length <= 1}
            >
              <span className="min-w-0 flex-1 truncate text-left">{getSelectedPlantDisplayName()}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="min-w-44 w-max max-w-[min(100vw-1.5rem,22rem)] p-0"
            align="end"
          >
            <Command>
              <CommandInput placeholder="Search Plant..." className="h-9" />
              <CommandList>
                <CommandEmpty>No plant found.</CommandEmpty>
                <CommandGroup>
                  {plantData.map((plant) => ( 
                    <CommandItem
                      key={plant.id}
                      value={plant.name.toLowerCase()}
                      className="gap-2 text-left text-[11px] items-start"
                      onSelect={() => {
                        handlePlantChange(plant.id);
                        setOpenPlant(false);
                      }}
                    >
                      <span
                        className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center"
                        aria-hidden
                      >
                        <Check
                          className={cn(
                            "h-3.5 w-3.5 shrink-0",
                            selectedPlant === plant.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                      </span>
                      <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug">
                        {plant.name}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};

export default ZonePlantSelections;