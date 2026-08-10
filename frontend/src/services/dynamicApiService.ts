import { useState, useCallback } from 'react';
import axios from 'axios';
import { apiClient } from './apiClient';

const useDynamicApiService = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const callApi = useCallback(async (config) => {
    const {
      url,
      method = 'get',
      params = {},
      body = {},
      headers = {},
    } = config;

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient({
        url,
        method,
        params,
        data: body,
        headers,
      });

      setData(response.data);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { callApi, data, error, isLoading };
};

export default useDynamicApiService;