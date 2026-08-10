import { useState, useEffect } from 'react';
import { SingleCSRejectionData, RejectionCategoryData } from '../Types';
import { CSRejectionResponse, RejectionData as APIRejectionData } from '../Types/api';
import { apiService } from '../services/api';

const transformAPIData = (apiData: APIRejectionData): RejectionCategoryData => {
  const current = apiData.rejection_rate || 0;
  return {
    current: parseFloat(current.toFixed(2)),
    previous: 0,
    percentage: 0,
    trend: 'stable',
    handled: apiData.handled || 0,
    sortout: apiData.sortout || 0,
    cylinder_filled: apiData.cylinder_filled || 0,
    negative_tare: apiData.negative_tare || 0,
    other_errors: apiData.other_errors || 0,
    overfilled: apiData.overfilled || 0,
    positive_tare: apiData.positive_tare || 0,
    rejection_rate: apiData.rejection_rate || 0,
    timeout: apiData.timeout || 0,
    underfilled: apiData.underfilled || 0,
    commErrorSortout: apiData.commErrorSortout || 0,
    error: false,
  };
};

const processCSRejectionResponse = (apiResponse: CSRejectionResponse): SingleCSRejectionData[] => {
  if (!apiResponse || typeof apiResponse !== 'object' || Object.keys(apiResponse).length === 0) {
    return [];
  }

  return Object.keys(apiResponse).map(carouselId => {
    const carouselData = apiResponse[carouselId];
    const transformedData = transformAPIData(carouselData);
    return {
      ...transformedData,
      carouselId: carouselId,
    };
  });
};

// THE FIX: The hook is no longer a named export.
const useCSRejectionChartData = (
  sapId: number | undefined,
  startDate: string | undefined,
  endDate: string | undefined,
  refreshKey?: number
) => {
  const [data, setData] = useState<SingleCSRejectionData[]>([]);
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
        const apiResponse = await apiService.getCSRejection(startDate, endDate, sapId, controller.signal);
        const processedData = processCSRejectionResponse(apiResponse);

        if (!controller.signal.aborted) {
          setData(processedData);
        }
      } catch (err: any) {
        if (err.name !== 'CanceledError') {
          setError(err.message || 'Failed to fetch CS Rejection chart data');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => controller.abort();
  }, [sapId, startDate, endDate, refreshKey]);

  return { data, loading, error };
};

// THE FIX: It is now exported as the default.
export default useCSRejectionChartData;
