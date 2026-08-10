import { useState, useEffect } from 'react';
import { ProcessedBottlingData, GroupedBottlingChartData } from '../Types';
import { BottlingSummaryResponse } from '../Types/api';
import { apiService } from '../services/api';

// THE FIX: This function is completely rewritten to handle multiple carousels.
const transformBottlingData = (apiResponse: BottlingSummaryResponse): ProcessedBottlingData => {
  if (!apiResponse || Object.keys(apiResponse).length === 0) {
    return { chartData: [], carouselKeys: [] };
  }

  const productionMap: { [prodName: string]: { [carouselName: string]: number } } = {};
  
  // Sort carousel IDs numerically to ensure a consistent order.
  const sortedCarouselIds = Object.keys(apiResponse).sort((a, b) => Number(a) - Number(b));
  const carouselKeys = sortedCarouselIds.map(id => `Carousel ${id}`);

  // Iterate through each carousel in the response.
  sortedCarouselIds.forEach(carouselId => {
    const carouselData = apiResponse[carouselId];
    const carouselName = `Carousel ${carouselId}`;
    
    // Iterate through each production key in the carousel data.
    for (const key in carouselData) {
      if (key.startsWith('production_')) {
        const value = carouselData[key];
        if (typeof value === 'number') {
          const prodName = key.replace('production_', 'Prod. ').replace(/_/g, '.') + 'kg';
          
          if (!productionMap[prodName]) {
            productionMap[prodName] = {};
          }
          productionMap[prodName][carouselName] = value;
        }
      }
    }
  });

  // Transform the map into the array format required by recharts for grouped bars.
  const chartData: GroupedBottlingChartData[] = Object.keys(productionMap).map(prodName => {
    const dataPoint: GroupedBottlingChartData = { name: prodName };
    carouselKeys.forEach(carouselName => {
      dataPoint[carouselName] = productionMap[prodName][carouselName] || 0;
    });
    return dataPoint;
  });

  return { chartData, carouselKeys };
};

export const useBottlingSummaryData = (
  sapId: number | undefined,
  startDate: string | undefined,
  endDate: string | undefined,
  refreshKey?: number
) => {
  // THE FIX: State now holds the new processed data structure.
  const [data, setData] = useState<ProcessedBottlingData>({ chartData: [], carouselKeys: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sapId || !startDate || !endDate) {
      setData({ chartData: [], carouselKeys: [] });
      return;
    }

    const controller = new AbortController();

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiResponse = await apiService.getBottlingSummary(startDate, endDate, sapId, controller.signal);
        const processedData = transformBottlingData(apiResponse);
        
        if (!controller.signal.aborted) {
          setData(processedData);
        }
      } catch (err: any) {
        if (err.name !== 'CanceledError') {
          setError(err.message || 'Failed to fetch bottling summary data');
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
