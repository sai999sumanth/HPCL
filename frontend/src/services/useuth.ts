import { useState, useEffect } from 'react';
import { apiClient } from './apiClient';

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isPocUser, setIsPocUser] = useState<boolean | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await apiClient.get('/api/session/me');
        if (response.status === 200 && response.data.email !== "-" && response.data.given_name !== "-") {
          setIsAuthenticated(true);
          setIsPocUser(response.data.is_poc_user === true);
        } else {
          setIsAuthenticated(false);
          setIsPocUser(null);
        }
      } catch (error) {
        console.error('Error checking session:', error);
        setIsAuthenticated(false);
        setIsPocUser(null);
      }
    };

    checkSession();
  }, []);
  
  return { isAuthenticated, isPocUser };
};