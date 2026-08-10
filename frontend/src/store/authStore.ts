import { create } from 'zustand';
import axios from 'axios';
import { toast } from 'sonner';
import debounce from 'lodash/debounce';
import { apiClient } from '@/services/apiClient';
// Update the UserData interface to better match how you're using it
interface AllowedMenu {
  title: string;
  allowed_sub_menus: AllowedMenu[];
}

interface MenuPermission {
  menu_name: string;
  allowed_sub_menus: AllowedMenu[];
}
interface UserData { 
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  novex_role: string[]; 
  is_authenticated: boolean;
  allowedPages: any[]; // Changed from any[] to string[] to match permissions
  permissions: any[]; // Changed from any[] to string[] based on API response
  system_role: string[];
  allowed_roles: any[];
  employee_id: string;
  bu: any[];
  region: any[];
  zone: any[];
  state: any[];
  sales_area: any[];
  sap_id: any[];
}

// Then ensure consistent mapping in both checkAuth and login methods

interface AuthState {
  user: UserData | null;
  isLoading: boolean;
  error: string | null;
  authChecked: boolean;
  checkAuth: () => Promise<void>;
  login: (username: string, password: string, login_type: string) => Promise<void>;
  ssoLogin: (code: string) => Promise<void>;
  hasPageAccess: (pagePath: MenuPermission) => boolean;
  hasButtonAccess: () => boolean;
  logout: () => Promise<void>;
}

interface ApiResponse {
  menu_name: any;
  allowed_sub_menus: MenuPermission[];
  sap_id: any[];
  sales_area: any[];
  state: any[];
  zone: any[];
  region: any[];
  bu: any[];
  allowed_roles: MenuPermission[];
  system_role: any[];
  is_authenticated: boolean;
  employee_id: string;
  email: string;
  first_name: string;
  novex_role: any[];
  last_name: string;
  permissions: MenuPermission[];
}

const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  error: null,
  authChecked: false,

  checkAuth: async () => {  
    try {
      // Skip if we've already checked and user is authenticated
      if (get().authChecked && get().user?.is_authenticated) return;

      set({ isLoading: true, error: null });
      const { data } = await apiClient.get<ApiResponse>('/api/session/me');

      if (data?.is_authenticated) {
        set({
          user: {
            id: data.employee_id,
            email: data.email,
            first_name: data.first_name,
            last_name: data.last_name,
            is_authenticated: true,
            novex_role: data.novex_role,
            allowedPages: data.permissions,
            permissions: data.permissions,
            system_role: data.system_role,
            allowed_roles: data.allowed_roles,
            bu: data.bu,
            region: data.region,
            zone: data.zone,
            state: data.state,
            sales_area: data.sales_area,
            sap_id: data.sap_id,
            employee_id: data.employee_id,
          },
          isLoading: false,
          authChecked: true
        });
      } else {
        set({
          user: null,
          error: 'Not authenticated',
          isLoading: false,
          authChecked: true
        });
      }
    } catch (error) {
      set({ 
        user: null,
        error: 'Session expired',
        isLoading: false,
        authChecked: true
      });
    }
  },

  login: async (username: string, password: string, login_type: string) => { 
    try {
      set({ isLoading: true, error: null });
      const loginResponse = await apiClient.post('/api/users/login', {
        username,
        password,
        login_type
      });

      if (loginResponse.status === 200) {
        const { data } = await apiClient.get<ApiResponse>('/api/session/me');
        
        if (data?.is_authenticated) {
          set({
            user: {
              id: data.employee_id,
              email: data.email,
              first_name: data.first_name,
              last_name: data.last_name,
              novex_role: data.novex_role,
              is_authenticated: true,
              allowedPages: data.permissions,
              permissions: data.permissions,
              system_role: data.system_role,
              allowed_roles: data.allowed_roles,
              bu: data.bu,
              region: data.region,
              zone: data.zone,
              state: data.state,
              sales_area: data.sales_area,
              sap_id: data.sap_id,
              employee_id: data.employee_id,

            },
            isLoading: false,
            authChecked: true
          });
          toast.success('Successfully logged in!');
        } else {
          throw new Error('Authentication failed');
        }
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const msg = error.response?.data?.msg || 'An error occurred while logging in';
        set({
          error: msg,
          isLoading: false,
          authChecked: true
        });
        toast.error(msg);
      }
    }
    console.log("loginType:-" , login_type);
  },

  ssoLogin: async (code: string) => {
    try {
      set({ isLoading: true, error: null });
      const ssoResponse = await apiClient.get('/api/users/sso_auth_callback', {
        params: {
          code: code
        }
      });

      if (ssoResponse.status === 200) {
        const { data } = await apiClient.get<ApiResponse>('/api/session/me');
        
        if (data?.is_authenticated) {
          set({
            user: {
              id: data.employee_id,
              email: data.email,
              first_name: data.first_name,
              last_name: data.last_name,
              novex_role: data.novex_role,
              is_authenticated: true,
              allowedPages: data.permissions,
              permissions: data.permissions,
              system_role: data.system_role,
              allowed_roles: data.allowed_roles,
              bu: data.bu,
              region: data.region,
              zone: data.zone,
              state: data.state,
              sales_area: data.sales_area,
              sap_id: data.sap_id,
              employee_id: data.employee_id,
            },
            isLoading: false,
            authChecked: true
          });
          toast.success('Successfully logged in!');
        } else {
          throw new Error('Authentication failed');
        }
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const msg = error.response?.data?.msg || 'An error occurred while logging in';
        set({
          error: msg,
          isLoading: false,
          authChecked: true
        });
        toast.error(msg);
      }
    }
  },

  hasPageAccess: (pagePath: MenuPermission) => {
    const { user } = get();
    return Boolean(user?.is_authenticated && user.allowedPages.includes(pagePath));
  },

  hasButtonAccess: () => {
    const { user } = get();
    return Boolean(user?.allowedPages.length === 0)
  },

  logout: async () => {
    try {
      await apiClient.get('/api/logout');
      set({ user: null, error: null });
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout on client side even if API fails
      set({ user: null, error: null });
      toast.success('Logged out successfully');
    } finally {
      // Notify other tabs so they redirect to login (storage event fires only in other tabs)
      try {
        localStorage.setItem('logout-event', Date.now().toString());
      } catch (_) {
        // ignore if localStorage is unavailable
      }
    }
  }
}));

export default useAuthStore;