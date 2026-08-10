import { useState, useEffect } from 'react';
import { PlantLocation } from '../Types';
import { apiClient } from '@/services/apiClient';

// This helper function is now updated to correctly map the fields from your API.
const transformApiDataToPlants = (data: any[]): PlantLocation[] => {
  if (!Array.isArray(data)) {
    console.error("Expected plant data to be an array, but received:", data);
    return [];
  }
  return data.map((item) => ({
    id: String(item.sap_id ?? item.id ?? ''),
    name: item.plant || item.location_name || item.name || 'Unknown Plant',
    sap_id: Number(item.sap_id ?? item.id ?? 0) || 0,
    location: item.location || item.plant || 'Unknown Location',
  }));
};


export const usePlantLocations = () => {
  const [plants, setPlants] = useState<PlantLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchIndex, setRefetchIndex] = useState(0);

  const refetchPlants = () => setRefetchIndex(prev => prev + 1);

  useEffect(() => {
    const controller = new AbortController();

    const fetchPlants = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log("[usePlantLocations] INITIATING API CALL to fetch plant locations.");

        const response = await apiClient.post('/api/charts/generate_vis_data', {
          action: 'plants_dropdown',
          payload: {
            filters: [],
            cross_filters: [],
            drill_state: ''
          }
        }, { signal: controller.signal as any });

        const core = response?.data?.data || response?.data || {};
        const list = Array.isArray(core?.plant) ? core.plant : [];

        console.log("[usePlantLocations] API CALL SUCCESS. Transforming data.");
        const transformedPlants = transformApiDataToPlants(list);
        
        if (!controller.signal.aborted) {
          setPlants(transformedPlants);
        }

      } catch (err: any) {
        if (err.name !== 'CanceledError') {
          setError(err.message || 'Failed to fetch plant locations');
          console.error('[usePlantLocations] API CALL FAILED:', err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchPlants();

    // Cleanup function to abort the request if the component unmounts
    return () => {
      controller.abort();
    };
  }, [refetchIndex]); // This effect now runs only when refetchIndex changes.

  return { plants, loading, error, refetchPlants };
};
