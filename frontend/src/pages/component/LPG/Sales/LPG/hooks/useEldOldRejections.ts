import { useState, useEffect } from 'react';
import { apiService } from '../services/api';

export type EldOldRejectionsData = {
  ELD?: Record<string, { handled: number; sortout: number; rejection_rate: number }>;
  OLD?: Record<string, { handled: number; sortout: number; rejection_rate: number }>;
};

/**
 * Fetches ELD & OLD rejections for the date range.
 * Calls /api/charts/generate_vis_data with action "get_eld_old_rejections".
 */
export const useEldOldRejections = (
  sapId: number | undefined,
  startDate: string | undefined,
  endDate: string | undefined,
  refreshKey?: number
) => {
  const [data, setData] = useState<EldOldRejectionsData>({});
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
        const response = await apiService.getEldOldRejections(
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
          setError(err.message || 'Failed to fetch ELD & OLD rejections');
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
