import { useState, useEffect } from 'react';
import { FillingAccuracyData } from '../Types';
import { FillingAccuracyResponse } from '../Types/api';
import { apiService } from '../services/api';

// THE FIX: This function now processes an array of raw data objects from the API.
const transformAPIResponse = (apiResponse: FillingAccuracyResponse): FillingAccuracyData[] => {
  if (!Array.isArray(apiResponse) || apiResponse.length === 0) {
    return [];
  }

  // Map each raw data object from the API to our clean FillingAccuracyData structure.
  return apiResponse.map(rawData => {
    const total_filled = rawData.count || 0;
    const on_target = rawData.nil_var || 0;
    const accuracy_rate = total_filled > 0 ? (on_target / total_filled) * 100 : 0;

    return {
      systemId: rawData.system_id, // Store the system ID for identification
      accuracy_rate: accuracy_rate,
      total_filled: total_filled,
      average_variance: rawData.average || 0,
      breakdown: {
        on_target: on_target,
        var_0_50: rawData.zero_fifty || 0,
        var_50_100: rawData.fifty_hundred || 0,
        var_100_plus: rawData.hundred_plus || 0,
      },
    };
  });
};

export const useFillingAccuracyData = (
  sapId: number | undefined,
  startDate: string | undefined,
  endDate: string | undefined,
  refreshKey?: number
) => {
  // THE FIX: The state now holds an array of data objects, one for each system.
  const [data, setData] = useState<FillingAccuracyData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sapId || !startDate || !endDate) {
      setData([]);
      return;
    }

    const controller = new AbortController();

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiResponse = await apiService.getFillingAccuracy(startDate, endDate, sapId, controller.signal);
        const processedData = transformAPIResponse(apiResponse);
        
        if (!controller.signal.aborted) {
          setData(processedData);
        }
      } catch (err: any) {
        if (err.name !== 'CanceledError') {
          setError(err.message || 'Failed to fetch filling accuracy data');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      controller.abort();
    };
  }, [sapId, startDate, endDate, refreshKey]);

  return { data, loading, error };
};
