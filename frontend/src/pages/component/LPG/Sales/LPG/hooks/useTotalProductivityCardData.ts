import { useState, useEffect } from 'react';
import { apiService } from '../services/api';

/**
 * Fetches total productivity (today) data for the Productivity card on Production Dashboard.
 * Calls /api/charts/generate_vis_data with action "get_total_productivity_today_data".
 * Response shape: { "Productivity": number, "Yesterday Productivity"?: number, "Change (%)"?: number }
 */
export const useTotalProductivityCardData = (
  sapId: number | undefined,
  startDate: string | undefined,
  endDate: string | undefined,
  refreshKey?: number
) => {
  const [data, setData] = useState<{
    Productivity?: number;
    'Yesterday Productivity'?: number;
    'Change (%)'?: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sapId || !startDate || !endDate) {
      setData(null);
      return;
    }

    const controller = new AbortController();

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiService.getTotalProductivityTodayData(
          startDate,
          endDate,
          sapId,
          controller.signal
        );
        if (!controller.signal.aborted) {
          setData(response);
        }
      } catch (err: any) {
        if (err.name !== 'CanceledError') {
          setError(err.message || 'Failed to fetch productivity card data');
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
