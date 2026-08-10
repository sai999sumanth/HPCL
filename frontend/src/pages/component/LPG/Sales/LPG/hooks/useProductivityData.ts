import { useState, useEffect } from 'react';
import { ProcessedProductivityData } from '../Types';
import { ProductivityResponse } from '../Types/api';
import { apiService } from '../services/api';

const isCarouselId = (key: string) => /^\d+$/.test(key);

// Process the multi-carousel response, keeping the full structure
const processProductivityResponse = (apiResponse: ProductivityResponse): ProcessedProductivityData => {
  const processedData: ProcessedProductivityData = {};

  for (const key in apiResponse) {
    // Ensure we are only processing own properties, not from the prototype chain.
    if (Object.prototype.hasOwnProperty.call(apiResponse, key)) {
      // For carousel IDs, keep the full data
      if (isCarouselId(key)) {
        processedData[key] = apiResponse[key];
      }
      // For total key, keep it as is
      else if (key === 'total') {
        processedData.total = apiResponse[key];
      }
    }
  }
  return processedData;
};

export const useProductivityData = (
  sapId: number | undefined,
  startDate: string | undefined,
  endDate: string | undefined,
  refreshKey?: number
) => {
  // THE FIX: The state now holds the new multi-carousel data structure.
  const [data, setData] = useState<ProcessedProductivityData>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sapId || !startDate || !endDate) {
      setData({});
      return;
    }

    const controller = new AbortController();

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiResponse = await apiService.getProductivity(startDate, endDate, sapId, controller.signal);
        const processedData = processProductivityResponse(apiResponse);

        if (!controller.signal.aborted) {
          setData(processedData);
        }
      } catch (err: any) {
        if (err.name !== 'CanceledError') {
          setError(err.message || 'Failed to fetch productivity data');
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
