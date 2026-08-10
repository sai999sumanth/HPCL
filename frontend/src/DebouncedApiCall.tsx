import React, { useState, useEffect, useCallback } from 'react';
import { debounce } from 'lodash';

interface DebouncedApiCallProps<T> {
  apiFunction: (...args: any[]) => Promise<T>;
  delay?: number;
  dependencies?: any[];
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

function DebouncedApiCall<T>({
  apiFunction,
  delay = 500,
  dependencies = [],
  onSuccess,
  onError
}: DebouncedApiCallProps<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const debouncedApiCall = useCallback(
    debounce(async (...args: any[]) => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiFunction(...args);
        setData(result);
        if (onSuccess) onSuccess(result);
      } catch (err) {
        setError(err as Error);
        if (onError) onError(err as Error);
      } finally {
        setLoading(false);
      }
    }, delay),
    [apiFunction, delay, onSuccess, onError]
  );

  useEffect(() => {
    debouncedApiCall();
    return () => {
      debouncedApiCall.cancel();
    };
  }, dependencies);

  return { data, loading, error, call: debouncedApiCall };
}

export default DebouncedApiCall;