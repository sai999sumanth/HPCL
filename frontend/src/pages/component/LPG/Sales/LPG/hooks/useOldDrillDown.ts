import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import type { OldDrillDownResponse } from '../services/api';

/**
 * Fetches OLD drill down for stacked bar chart.
 * Calls /api/charts/generate_vis_data with action "get_old_drill_down".
 */
export const useOldDrillDown = (
  sapId: number | undefined,
  startDate: string | undefined,
  endDate: string | undefined,
  refreshKey?: number
) => {
  const [data, setData] = useState<OldDrillDownResponse>({});
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
        const response = await apiService.getOldDrillDown(
          startDate,
          endDate,
          sapId,
          controller.signal
        );
        if (!controller.signal.aborted) {
          setData(response ?? {});
        }
      } catch (err: any) {
        if (err.name !== 'CanceledError') {
          setError(err.message || 'Failed to fetch OLD drill down');
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
