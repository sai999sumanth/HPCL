import { useState, useEffect } from 'react';
import { AllRejectionData, RejectionCategoryData } from '../Types';
import { apiService } from '../services/api';
import { RejectionData as APIRejectionData } from '../Types/api';

const transformAPIData = (apiData: APIRejectionData): RejectionCategoryData => {
  // THE FIX: The 'current' value is now the exact rate from the API, not a rounded one.
  const current = apiData.rejection_rate || 0;

  return {
    current: current,
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
    error: false, // Explicitly set error to false on success
  };
};

const createDefaultRejectionData = (hasError: boolean = false): RejectionCategoryData => ({
  current: 0,
  previous: 0,
  trend: 'stable',
  percentage: 0,
  handled: 0,
  sortout: 0,
  cylinder_filled: 0,
  negative_tare: 0,
  other_errors: 0,
  overfilled: 0,
  positive_tare: 0,
  rejection_rate: 0,
  timeout: 0,
  underfilled: 0,
  commErrorSortout: 0,
  error: hasError, // Set the error state
});

export const useRejectionData = (
  sapId: number | undefined,
  startDate: string | undefined,
  endDate: string | undefined,
  refreshKey?: number
) => {
  const [data, setData] = useState<AllRejectionData>({
    cs: createDefaultRejectionData(),
    gd: createDefaultRejectionData(),
    pt: createDefaultRejectionData(),
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sapId || !startDate || !endDate) {
      return;
    }

    const controller = new AbortController();
    const fetchData = async () => {
      setLoading(true);

      try {
        const results = await Promise.allSettled([
          apiService.getCSRejectionCard(startDate, endDate, sapId, controller.signal),
          apiService.getGDRejection(startDate, endDate, sapId, controller.signal),
          apiService.getPTRejection(startDate, endDate, sapId, controller.signal),
        ]);

        if (controller.signal.aborted) return;

        const [csResult, gdResult, ptResult] = results;

        const csData = csResult.status === 'fulfilled'
          ? transformAPIData(csResult.value)
          : createDefaultRejectionData(true);

        const gdData = gdResult.status === 'fulfilled'
          ? transformAPIData(gdResult.value)
          : createDefaultRejectionData(true);

        const ptData = ptResult.status === 'fulfilled'
          ? transformAPIData(ptResult.value)
          : createDefaultRejectionData(true);
        
        setData({ cs: csData, gd: gdData, pt: ptData });

      } catch (err: any) {
        if (err.name !== 'CanceledError') {
          console.error("An unexpected error occurred in useRejectionData:", err);
          setData({
            cs: createDefaultRejectionData(true),
            gd: createDefaultRejectionData(true),
            pt: createDefaultRejectionData(true),
          });
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

  return { data, loading };
};
