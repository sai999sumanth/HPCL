import { useState, useEffect, useCallback, useRef } from 'react';
import axios, { AxiosError } from 'axios';
// import {  Alert, Plant, Zone } from '../components/types/location';
import {   Plant, Zone } from '../components/types/location';
import { apiClient } from "@/services/apiClient";

/** Module-level deduplication: shared in-flight promise and cache for default TAS fetch across all hook instances */
type LocationResult = { zones: Zone[]; plants: Plant[]; regions: string[]; salesAreas: string[] };
let sharedInFlightPromise: Promise<LocationResult | null> | null = null;
let sharedCache: (LocationResult & { _ts: number }) | null = null;
const locationInFlightByKey = new Map<string, Promise<LocationResult | null>>();
const locationCacheByKey = new Map<string, (LocationResult & { _ts: number })>();
const CACHE_TTL_MS = 60_000; // 1 minute - skip refetch if cache is fresh

export function useLocations({
  enabled = true,
}: {
  enabled?: boolean;
} = {}) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [salesAreas, setSalesAreas] = useState<string[]>([]);
  // const [alerts, setAlerts] = useState<Alert[]>([]);

  const [loading, setLoading] = useState(false);
  const [alertLoading, setAlertLoading] = useState(false);

  const [error, setError] = useState<string>('');
  const [alertError, setAlertError] = useState<string>('');

  const isMountedRef = useRef(true);
  const hasInitialFetchRef = useRef(false);
  const isFetchingRef = useRef(false); // Prevent concurrent fetches

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      hasInitialFetchRef.current = false; // Reset on unmount so a real remount can refetch
    };
  }, []);

  const fetchLocations = useCallback(async (
    bu?: string,
    selectedZonesParam?: string[],
    roFilters?: { region?: string; sales_area?: string }
  ) => {
    const apiBu = bu && bu !== 'all' ? bu : 'TAS';
    const zoneValues = Array.isArray(selectedZonesParam)
      ? selectedZonesParam
          .map((z) => String(z ?? "").trim())
          .filter(Boolean)
      : [];
    const zoneFilter = zoneValues.length > 0 ? zoneValues[0] : "";
    const isDefaultRequest = apiBu === 'TAS' && zoneFilter === '' && !roFilters?.region && !roFilters?.sales_area;
    const requestKey = JSON.stringify({
      bu: [apiBu],
      zone: [...zoneValues].sort(),
      region: roFilters?.region ? [String(roFilters.region).trim()] : [""],
      sales_area: roFilters?.sales_area ? [String(roFilters.sales_area).trim()] : [""],
      sap_id: [""],
    });

    // Use shared cache/dedup for default TAS request to avoid multiple API calls
    if (isDefaultRequest) {
      if (sharedCache && Date.now() - sharedCache._ts < CACHE_TTL_MS) {
        if (isMountedRef.current) {
          setZones(sharedCache.zones);
          setPlants(sharedCache.plants);
          setRegions(sharedCache.regions);
          setSalesAreas(sharedCache.salesAreas);
          setError('');
        }
        return;
      }
      if (sharedInFlightPromise) {
        if (isMountedRef.current) setLoading(true);
        try {
          const result = await sharedInFlightPromise;
          if (isMountedRef.current && result) {
            setZones(result.zones);
            setPlants(result.plants);
            setRegions(result.regions);
            setSalesAreas(result.salesAreas);
            setError('');
          }
        } finally {
          if (isMountedRef.current) setLoading(false);
        }
        return;
      }
    }

    // Generic dedup/cache for all request payloads (handles edit flow + Strict Mode remounts).
    const cached = locationCacheByKey.get(requestKey);
    if (cached && Date.now() - cached._ts < CACHE_TTL_MS) {
      if (isMountedRef.current) {
        if (!zoneValues.length) setZones(cached.zones);
        setPlants(cached.plants);
        setRegions(cached.regions);
        setSalesAreas(cached.salesAreas);
        setError('');
      }
      return;
    }
    const inFlightForKey = locationInFlightByKey.get(requestKey);
    if (inFlightForKey) {
      if (isMountedRef.current) setLoading(true);
      try {
        const result = await inFlightForKey;
        if (isMountedRef.current && result) {
          if (!zoneValues.length) setZones(result.zones);
          setPlants(result.plants);
          setRegions(result.regions);
          setSalesAreas(result.salesAreas);
          setError('');
        }
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
      return;
    }

    // When user explicitly selects a BU (RO/LPG/TAS), always run the request
    const explicitBu = bu && bu !== 'all';
    if (isFetchingRef.current && !explicitBu) {
      return;
    }

    if (isMountedRef.current) setLoading(true);
    isFetchingRef.current = true;

    const doFetch = async (): Promise<LocationResult | null> => {
      const payload = {
        bu: [apiBu],
        zone: selectedZonesParam && selectedZonesParam.length > 0 ? selectedZonesParam : [""],
        region: roFilters?.region ? [roFilters.region] : [""],
        sales_area: roFilters?.sales_area ? [roFilters.sales_area] : [""],
        sap_id: [""],
      };

      const response = await apiClient.post(
        '/api/ticketing/get_location_data',
        payload,
        { headers: { 'Content-Type': 'application/json' } }
      );

      const data = response.data;

      if (!data || data.status !== true) {
        throw new Error(data?.message || 'Failed to fetch locations');
      }

      const d = data.data ?? {};

        const zonesArr: any[] = Array.isArray(d.zones)
          ? d.zones
          : Array.isArray(d.zone)
            ? d.zone
            : Array.isArray(d.zoneData)
              ? d.zoneData
              : [];

        const zonesNormalized: Zone[] = zonesArr
          .map((z: any) => {
            if (z && typeof z === "object") {
              const id = String((z as any).id ?? (z as any).zone ?? (z as any).name ?? "").trim();
              const name = String((z as any).name ?? (z as any).zone ?? id).trim();
              return id ? ({ id, name } as Zone) : null;
            }
            const s = String(z ?? "").trim();
            return s ? ({ id: s, name: s } as Zone) : null;
          })
          .filter(Boolean) as Zone[];

      
        const locationSapArr: any[] = Array.isArray(d.location_sap_id) ? d.location_sap_id : [];
        const sapIdsArr: any[] = Array.isArray(d.sap_ids) ? d.sap_ids : [];
        const namesArr: any[] = Array.isArray(d.names) ? d.names : [];
        const locationsArr: any[] = Array.isArray(d.locations) ? d.locations : [];

        let plantsNormalized: Plant[] = [];
        if (locationsArr.length > 0) {
          // API returns locations as [{ sap_id, name }, ...] (e.g. "All filter values" response)
          plantsNormalized = locationsArr
            .map((loc: any) => {
              const sapId = String(loc?.sap_id ?? loc?.id ?? "").trim();
              const name = String(loc?.name ?? loc?.location_name ?? "").trim();
              if (!sapId && !name) return null;
              return {
                id: sapId || name,
                name: name || sapId,
                label: name,
                location_name: name,
              } as Plant;
            })
            .filter(Boolean) as Plant[];
        } else if (locationSapArr.length > 0) {
          plantsNormalized = locationSapArr
            .map((entry) => {
              const s = String(entry ?? "").trim();
              if (!s) return null;

              // Expected: "LOCATION NAME - 1234"
              // Extract SAP id from the last " - " segment, fallback to regex digits at end.
              let sapId = "";
              let locationName = s;
              const sepIdx = s.lastIndexOf(" - ");
              if (sepIdx >= 0) {
                locationName = s.slice(0, sepIdx).trim();
                sapId = s.slice(sepIdx + 3).trim();
              } else {
                const m = s.match(/(\d+)\s*$/);
                sapId = m?.[1] ?? "";
                if (sapId) locationName = s.replace(new RegExp(`\\s*${sapId}\\s*$`), "").trim();
              }

              const id = sapId || s;
              const name = locationName || s;

              return {
                id,
                name,
                label: s, // keep full "LOCATION - SAP" available if needed
                location_name: name,
              } as Plant;
            })
            .filter(Boolean) as Plant[];
        } else if (sapIdsArr.length > 0) {
          plantsNormalized = sapIdsArr
            .map((sap, idx) => {
              const id = String(sap ?? "").trim();
              if (!id) return null;
              const nm = String(namesArr[idx] ?? "").trim();
              const name = nm || id;
              return {
                id,
                name,
                label: name,
                location_name: name,
              } as Plant;
            })
            .filter(Boolean) as Plant[];
        } else if (Array.isArray(d.plant)) {
          plantsNormalized = d.plant as Plant[];
        } else if (Array.isArray(d.plants)) {
          plantsNormalized = d.plants as Plant[];
        }
  
        // Extract regions (for RO BU - used in dynamic form fields)
        const regionsArr: any[] = Array.isArray(d.regions) ? d.regions : Array.isArray(d.region) ? d.region : [];
        const regionsNormalized: string[] = regionsArr
          .map((r: any) => {
            if (r && typeof r === "object") {
              return String((r as any).name ?? (r as any).region ?? (r as any).id ?? "").trim();
            }
            return String(r ?? "").trim();
          })
          .filter(Boolean)
          .filter((r, idx, arr) => arr.indexOf(r) === idx);

        // Extract sales areas (for RO BU - used in dynamic form fields)
        const salesAreasArr: any[] = Array.isArray(d.sales_areas)
          ? d.sales_areas
          : Array.isArray(d.sales_area)
            ? d.sales_area
            : [];
        const salesAreasNormalized: string[] = salesAreasArr
          .map((sa: any) => {
            if (sa && typeof sa === "object") {
              return String((sa as any).name ?? (sa as any).sales_area ?? (sa as any).id ?? "").trim();
            }
            return String(sa ?? "").trim();
          })
          .filter(Boolean)
          .filter((sa, idx, arr) => arr.indexOf(sa) === idx);

        const result: LocationResult = {
          zones: zonesNormalized,
          plants: plantsNormalized,
          regions: regionsNormalized,
          salesAreas: salesAreasNormalized,
        };
        return result;
      };


    const hadZoneFilter = zoneValues.length > 0;
    const applyResult = (res: LocationResult | null) => {
      if (!isMountedRef.current || !res) return;
      if (!hadZoneFilter) {
        setZones(res.zones);
      }
      setPlants(res.plants);
      setRegions(res.regions);
      setSalesAreas(res.salesAreas);
      setError('');
    };

    try {
      let result: LocationResult | null = null;
      if (isDefaultRequest && !locationInFlightByKey.has(requestKey)) {
        sharedInFlightPromise = doFetch();
        locationInFlightByKey.set(requestKey, sharedInFlightPromise);
        result = await sharedInFlightPromise.then((r) => {
          if (r) {
            const cachedResult = { ...r, _ts: Date.now() };
            sharedCache = cachedResult;
            locationCacheByKey.set(requestKey, cachedResult);
          }
          return r;
        });
        sharedInFlightPromise = null;
        locationInFlightByKey.delete(requestKey);
      } else {
        const keyedPromise = doFetch();
        locationInFlightByKey.set(requestKey, keyedPromise);
        result = await keyedPromise.then((r) => {
          if (r) {
            locationCacheByKey.set(requestKey, { ...r, _ts: Date.now() });
          }
          return r;
        });
        locationInFlightByKey.delete(requestKey);
      }
      applyResult(result);
    } catch (err) {
      locationInFlightByKey.delete(requestKey);
      const isAborted = axios.isAxiosError(err) && err.code === 'ERR_CANCELED' || (err instanceof Error && err.name === 'AbortError');
      if (isAborted) {
        return; // Don't update state for aborted requests
      }
      if (isMountedRef.current) {
        let errorMessage = 'Failed to fetch locations';
        if (axios.isAxiosError(err)) {
          const axiosErr = err as AxiosError<{ message?: string }>;
          errorMessage = axiosErr.response?.data?.message || axiosErr.message || errorMessage;
        } else if (err instanceof Error) {
          errorMessage = err.message;
        }
        console.error('Error fetching locations:', err);
        setError(errorMessage);
        setZones([]);
        setPlants([]);
        setRegions([]);
        setSalesAreas([]);
      }
    } finally {
      isFetchingRef.current = false;
      if (isMountedRef.current) setLoading(false);
    }
  }, []);

  // useEffect(() => {
  //   fetchLocations();
  //   // fetchAlerts();
  // }, [fetchLocations]);
  
//  useEffect(() => {
//     fetchLocations();
//     // fetchAlerts();
//   }, []);
// NEW CODE - ADD THIS:

useEffect(() => {
  // Only fetch once on mount, even in React Strict Mode
  if (!enabled) return;
  if (!hasInitialFetchRef.current && !isFetchingRef.current) {
    hasInitialFetchRef.current = true;
    fetchLocations();
  }
}, [fetchLocations, enabled]);
  
  return {
    zones,
    plants,
    regions,
    salesAreas,
    // alerts,
    loading,
    alertLoading,
    error,
    alertError,
    refetchLocations: fetchLocations,
    // refetchAlerts: fetchAlerts,
  };
}