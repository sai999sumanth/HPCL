import { useState, useCallback } from 'react';
import { alertService } from '../services/alertService';
import { AlertRecord, PaginationInfo } from '../types';

interface Filter {
  key: string;
  cond: string;
  value: string;
}

export const useAlerts = () => {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async (filters: Filter[]) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await alertService.getAlerts(filters);
      setAlerts(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setAlerts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    alerts,
    isLoading,
    error,
    fetchAlerts
  };
};
