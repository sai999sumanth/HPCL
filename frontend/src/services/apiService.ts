// types.ts
export interface RequestConfig extends RequestInit {
  params?: Record<string, string | number | boolean>;
  baseURL?: string;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
}

import useAuthStore from "../store/authStore";

// apiService.ts
class ApiService {
  getProductivity(fromDate: string, toDate: string, sapId: number, signal: AbortSignal) {
    throw new Error('Method not implemented.');
  }
  private baseURL: string;

  constructor(baseURL: string = import.meta.env.VITE_API_URL || '') {
    this.baseURL = baseURL;
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    // Handle 401 Unauthorized - automatically logout and redirect to login
    if (response.status === 401) {
      console.warn("401 Unauthorized - Logging out and redirecting to login");
      // Use the auth store's logout function
      const authStore = useAuthStore.getState();
      authStore.logout().finally(() => {
        // Redirect to login page regardless of logout API success/failure
        window.location.href = '/';
      });
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Unauthorized');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    };
  }

  private createUrl(endpoint: string, params?: Record<string, string | number | boolean>): string {
    const url = new URL(endpoint, this.baseURL);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }
    
    return url.toString();
  }

  private async request<T>(endpoint: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    const { params, headers = {}, ...restConfig } = config;
    
    const url = this.createUrl(endpoint, params);
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };

    try {
      const response = await fetch(url, {
        ...restConfig,
        headers: defaultHeaders,
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      throw new Error(`API request failed: ${(error as Error).message}`);
    }
  }

  public async get<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  public async post<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async put<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async patch<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  public async delete<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }
}

// Create and export a default instance
export const apiService = new ApiService();
export default apiService;