import { useState, useEffect } from 'react';
import { apiService } from '../services/api';

/**
 * Fetches total production (today) data for the Production card on Production Dashboard.
 * Calls /api/charts/generate_vis_data with action "get_total_production_today_data".
 * Response: { "Total Production": number, "Yesterday Production"?: number, "Change (%)"?: number }
 */
export const useTotalProductionCardData = (
  sapId: number | undefined,
  startDate: string | undefined,
  endDate: string | undefined,
  refreshKey?: number
) => {
  const [data, setData] = useState<{
    'Total Production'?: number;
    'Yesterday Production'?: number;
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
        const response = await apiService.getTotalProductionTodayData(
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
          setError(err.message || 'Failed to fetch production card data');
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
