import { useState, useEffect } from 'react';
import { apiService } from '../services/api';

/**
 * Fetches underperforming scales data for Production Dashboard.
 * Calls /api/charts/generate_vis_data with action "under_performance_scales".
 * Payload: { time, sap_id } only (no date range).
 */
export const useUnderPerformanceScales = (
  sapId: number | undefined,
  time: string,
  refreshKey?: number
) => {
  const [data, setData] = useState<{ rows: any[]; meta?: Record<string, string> }>({ rows: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sapId || !time) {
      setData({ rows: [] });
      return;
    }

    const controller = new AbortController();

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiService.getUnderPerformanceScales(
          sapId,
          time,
          controller.signal
        );
        if (!controller.signal.aborted) {
          setData(response ?? { rows: [] });
        }
      } catch (err: any) {
        if (err.name !== 'CanceledError') {
          setError(err.message || 'Failed to fetch underperforming scales');
        }
        if (!controller.signal.aborted) {
          setData({ rows: [] });
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
  }, [sapId, time, refreshKey]);

  return { data, loading, error };
};
