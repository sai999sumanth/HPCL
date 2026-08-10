import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/@/components/ui/popover";
import { apiClient } from "@/services/apiClient";

/** BU codes accepted by `/api/ticketing/get_location_data` for KPI dashboards. */
export type KpiDashboardLocationBu = "TAS" | "LPG" | "RO";

/** Shared fields for `get_location_data` (caller supplies `bu` per page). */
export const KPI_TICKETING_LOCATION_BASE = {
  zone: [""] as string[],
  region: [""] as string[],
  sales_area: [""] as string[],
  sap_id: [""] as string[],
} as const;

type SelectOption = { id: string; name: string };

export type KpiDashboardLocationDropdownsProps = {
  /** Match the dashboard route: TAS / LPG KPI pages or RO for retail stockouts. */
  bu: KpiDashboardLocationBu;
  /** Called when zone or plant (sap) selection changes. Use `null` for “All”. */
  onSelectionChange: (selection: { zone: string | null; sapId: string | null }) => void;
  className?: string;
  /**
   * `toolbar` — inline with the top filter row (zone/plant where carousel was).
   * `block` — full-width row with bottom border (legacy layout).
   */
  layout?: "toolbar" | "block";
};

/**
 * Zone + plant comboboxes, same pattern as Retail Outlet home (`ZonePlantSelections`),
 * using `get_location_data` with the page’s `bu` (TAS, LPG, or RO).
 */
const KpiDashboardLocationDropdowns: React.FC<KpiDashboardLocationDropdownsProps> = ({
  bu,
  onSelectionChange,
  className,
  layout = "toolbar",
}) => {
  const [zoneData, setZoneData] = useState<SelectOption[]>([]);
  const [plantData, setPlantData] = useState<SelectOption[]>([]);
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedPlant, setSelectedPlant] = useState("");
  const [openZone, setOpenZone] = useState(false);
  const [openPlant, setOpenPlant] = useState(false);

  const fetchingRef = useRef(false);
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  const fetchInitial = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const response = await apiClient.post("/api/ticketing/get_location_data", {
        ...KPI_TICKETING_LOCATION_BASE,
        bu: [bu],
      });
      if (response?.data?.status === true && response.data.data) {
        const d = response.data.data;
        if (Array.isArray(d.zones)) {
          const allZones = { id: "all", name: "All Zones" };
          const sorted = [...d.zones]
            .sort((a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" }))
            .map((z: string) => ({ id: z, name: z }));
          setZoneData([allZones, ...sorted]);
        }
        if (Array.isArray(d.locations)) {
          const allPlants = { id: "all", name: "All Plants" };
          const sorted = [...d.locations]
            .map((loc: { sap_id: string; name?: string }) => ({
              id: loc.sap_id,
              name: loc.name ?? loc.sap_id,
            }))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
          setPlantData([allPlants, ...sorted]);
        }
        setSelectedZone("all");
        setSelectedPlant("all");
        onSelectionChangeRef.current({ zone: null, sapId: null });
      }
    } catch (e) {
      console.error("KPI location dropdown: initial fetch failed", e);
    } finally {
      fetchingRef.current = false;
    }
  }, [bu]);

  const fetchPlantsForZone = useCallback(async (zone: string) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const response = await apiClient.post("/api/ticketing/get_location_data", {
        ...KPI_TICKETING_LOCATION_BASE,
        bu: [bu],
        zone: zone ? [zone] : [""],
      });
      if (response?.data?.status === true && Array.isArray(response.data.data?.locations)) {
        const allPlants = { id: "all", name: "All Plants" };
        const sorted = [...response.data.data.locations]
          .map((loc: { sap_id: string; name?: string }) => ({
            id: loc.sap_id,
            name: loc.name ?? loc.sap_id,
          }))
          .sort((a: { name: string }, b: { name: string }) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
          );
        setPlantData([allPlants, ...sorted]);
      } else {
        setPlantData([{ id: "all", name: "All Plants" }]);
      }
    } catch (e) {
      console.error("KPI location dropdown: zone filter fetch failed", e);
      setPlantData([{ id: "all", name: "All Plants" }]);
    } finally {
      fetchingRef.current = false;
    }
  }, [bu]);

  useEffect(() => {
    void fetchInitial();
  }, [fetchInitial]);

  const emit = useCallback((zone: string, plant: string) => {
    const z = zone === "all" || !zone ? null : zone;
    const p = plant === "all" || !plant ? null : plant;
    onSelectionChangeRef.current({ zone: z, sapId: p });
  }, []);

  const handleZoneChange = async (zoneId: string) => {
    setSelectedZone(zoneId);
    emit(zoneId, "all");
    if (zoneId && zoneId !== "all") {
      await fetchPlantsForZone(zoneId);
    } else {
      await fetchInitial();
    }
    setSelectedPlant("all");
  };

  const handlePlantChange = (plantId: string) => {
    setSelectedPlant(plantId);
    emit(selectedZone, plantId);
  };

  const zoneLabel = () => {
    if (!selectedZone || selectedZone === "all") return "Select Zone";
    const z = zoneData.find((x) => x.id === selectedZone);
    return z?.name ?? "Select Zone";
  };

  const plantLabel = () => {
    if (!selectedPlant || selectedPlant === "all") return "Select Plant";
    const p = plantData.find((x) => x.id === selectedPlant);
    return p?.name ?? "Select Plant";
  };

  /** Match `RetailOutletHome/ZonePlantSelections` trigger + popover classes. */
  const triggerClass = "w-42 h-7 text-xs justify-between";
  const popoverWidthClass = "w-42 p-0";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1",
        layout === "block" && "w-full justify-end border-b border-gray-100 pb-2 mb-1",
        layout === "toolbar" && "shrink-0 items-center",
        className
      )}
    >
      <Popover open={openZone} onOpenChange={setOpenZone}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={openZone} className={triggerClass}>
            <span className="truncate">{zoneLabel()}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className={popoverWidthClass} align="start">
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
                      void handleZoneChange(zone.id);
                      setOpenZone(false);
                    }}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", selectedZone === zone.id ? "opacity-100" : "opacity-0")}
                    />
                    {zone.name}
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
            className={triggerClass}
            disabled={!selectedZone}
          >
            <span className="truncate">{plantLabel()}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className={popoverWidthClass} align="start">
          <Command>
            <CommandInput placeholder="Search Plant..." className="h-9" />
            <CommandList>
              <CommandEmpty>No plant found.</CommandEmpty>
              <CommandGroup>
                {plantData.map((plant) => (
                  <CommandItem
                    key={plant.id}
                    value={plant.name.toLowerCase()}
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
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default KpiDashboardLocationDropdowns;
