import { useState, useEffect } from 'react';
import { apiService } from '../services/api';

/** API response: labels (time slots), overall (c1, c2, ...), c1_rate, c2_rate, ... */
export type ProductivityHistoryResponse = {
  labels: string[];
  overall: Record<string, number>;
  [key: string]: string[] | Record<string, number> | number[] | undefined;
};

/**
 * Fetches productivity history (line chart). No date filter is sent.
 * Response: { labels, overall: { c1, c2, ... }, c1_rate, c2_rate, ... }
 */
export const useProductivityHistory = (
  sapId: number | undefined,
  startDate: string | undefined,
  endDate: string | undefined,
  refreshKey?: number
) => {
  const [data, setData] = useState<ProductivityHistoryResponse>({ labels: [], overall: {} });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sapId) {
      setData({ labels: [], overall: {} });
      return;
    }

    const controller = new AbortController();

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiService.getProductivityHistory(
          sapId,
          controller.signal
        );
        if (!controller.signal.aborted) {
          const empty: ProductivityHistoryResponse = { labels: [], overall: {} };
          setData(response?.labels ? response as ProductivityHistoryResponse : empty);
        }
      } catch (err: any) {
        if (err.name !== 'CanceledError') {
          setError(err.message || 'Failed to fetch productivity history');
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
  }, [sapId, refreshKey]);

  return { data, loading, error };
};
