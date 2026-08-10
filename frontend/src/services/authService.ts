import axios, { AxiosError } from 'axios';
import { apiClient } from './apiClient';

export interface UserInfo {
  given_name: string;
  family_name: string;
  email: string;
  entity_id: string;
}

class AuthService {
  private static instance: AuthService;
  
  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  } 

  public async entityLogin(entityId: string): Promise<boolean> {
    try { 
      window.location.href = `/api/${entityId}/authorize`;
      return true;
    } catch (error) {
      console.error('Failed to redirect to login page:', error);
      return false;
    }
  }

  public async checkSession(): Promise<boolean> {
    try {
      const response = await apiClient.get('/api/session/me');
      return response.status === 200 && response.data.email;
    } catch (error) {
      console.error('Error checking session:', error);
      return false;
    }
  }

  public async getUserInfo(): Promise<UserInfo | null> {
    try {
      const response = await apiClient.get('/api/session/me');
      if (response.status === 200 && response.data.email && response.data.entity_id) {
        return {
          given_name: response.data.given_name,
          family_name: response.data.family_name,
          email: response.data.email,
          entity_id: response.data.entity_id
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching user info:', error);
      return null;
    }
  }

  public async logout(): Promise<void> {
    try {
      await apiClient.get('/api/logout');
      window.location.href = '/';
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response && axiosError.response.status === 401) {
          const data = axiosError.response.data as { url?: string };
          if (data && data.url) {
            window.location.href = data.url;
            return;
          }
        }
      }
      console.error('Error during logout:', error);
      window.location.href = '/';
    }
  }
}

export default AuthService.getInstance();