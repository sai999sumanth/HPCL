import axios, { isCancel, AxiosInstance } from "axios";
import { encryptPayload, decryptPayload } from "../configs/encryptFernet";
import { config } from "../configs/excrypt.config";
import useAuthStore from "../store/authStore";

const apiClient = axios.create({
  baseURL: config.api.baseUrl,
  timeout: 100000,
}) as AxiosInstance & {
  postStream: (url: string, data: any, config?: any) => Promise<{
    data: {
      getReader: () => ReadableStreamDefaultReader<Uint8Array>;
      body: ReadableStream<Uint8Array> | null;
    };
    body: ReadableStream<Uint8Array> | null;
  }>;
};

/**
 * This service provides a customized Axios client for making API requests
 * to the backend. It includes encryption/decryption logic for encrypting
 * request data and decrypting response data, as well as a request interceptor
 * that automatically encrypts data before sending.
 *
 * Usage:
 * 
 * const response = await apiClient.get('/api/data', {
 *   params: {
 *     data: JSON.stringify({
 *       key: 'value'
 *     })
 *   }
 * });
 *
 * @param {string} url - The URL to make the request to.
 * @param {AxiosRequestConfig} [config] - Optional Axios request configuration.
 * @returns {Promise<AxiosResponse>} - The response from the API.
 */

const AUTH_ENDPOINTS_EXCLUDED_FROM_401_LOGOUT = [
  '/api/users/login',
  '/api/login',
  '/api/users/mfa_otp_validation',
  '/api/users/resend_mfa_otp',
];

const shouldSkip401Logout = (url?: string): boolean => {
  if (!url) return false;
  return AUTH_ENDPOINTS_EXCLUDED_FROM_401_LOGOUT.some((endpoint) => url.includes(endpoint));
};

// Request interceptor - automatically encrypt data before sending
apiClient.interceptors.request.use( 
  (requestConfig) => { 
    // LOG UNENCRYPTED PAYLOAD FOR DEBUGGING
    console.log('=== API REQUEST PAYLOAD (UNENCRYPTED) ===');
    console.log('URL:', requestConfig.url);
    console.log('Method:', requestConfig.method?.toUpperCase());
    console.log('Headers:', requestConfig.headers);
    
    if (requestConfig.data) { 
      console.log('Request Body (unencrypted):', JSON.stringify((requestConfig.data)) );
    }
    
    if (requestConfig.params) {
      console.log('Request Params (unencrypted):', requestConfig.params);
    }

    console.log('==========================================');

    if (!config.encryption.enabled) {
      return requestConfig;
    }

    try { 
      const isFormData = requestConfig.data instanceof FormData;

      // Encrypt POST/PUT/PATCH request body data
      if (requestConfig.data && ['post', 'put', 'patch'].includes(requestConfig.method?.toLowerCase())) {
        if (isFormData) {
          // For FormData (file uploads), don't encrypt and let axios set Content-Type automatically
          // Remove any manually set Content-Type to let axios handle multipart/form-data boundary
          if (requestConfig.headers['Content-Type'] === 'multipart/form-data') {
            delete requestConfig.headers['Content-Type'];
          }
          // Don't encrypt FormData
          return requestConfig;
        } else {
          // For regular JSON data, encrypt as before
          const encryptedData = encryptPayload(requestConfig.data);
          

          requestConfig.data = encryptedData;
          
          // Add header to indicate encrypted content
          requestConfig.headers.set('Content-Type', 'application/json');
        }
      } else if (requestConfig.params) {
        const encryptedData = encryptPayload(requestConfig.params);
        requestConfig.params = {};
        requestConfig.url = requestConfig.url + "?" + encryptedData;
        
        requestConfig.headers.set('Content-Type', 'application/json');
      }
    } catch (error) {
      console.error("Request encryption error:", error);
      return Promise.reject(error);
    } 
    return requestConfig;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - automatically decrypt response data
apiClient.interceptors.response.use(
  (response) => {
    // LOG ENCRYPTED RESPONSE FOR DEBUGGING

    if (!config.encryption.enabled) {
      // LOG UNENCRYPTED RESPONSE WHEN ENCRYPTION IS DISABLED
      return response;
    }

    try {
      // Check if response indicates encrypted content
      const isEncrypted = response.headers['Content-Type'] === 'application/json' || 
                          (response.data && typeof response.data.data === 'string');
      
      if (isEncrypted && response.data && response.data.data) {
        const decryptedData = decryptPayload(response.data.data);
        
        // LOG DECRYPTED RESPONSE FOR DEBUGGING
        
        response.data = decryptedData;
      } else {
        // LOG UNENCRYPTED RESPONSE
      }
      
      return response;
    } catch (error) {
      console.error("Response decryption error:", error);
      return response; // Return original response if decryption fails
    }
  },
  (error) => { 
    // Handle 401 Unauthorized - automatically logout and redirect to login
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url || '';

      if (!shouldSkip401Logout(requestUrl)) {
        console.warn("401 Unauthorized - Logging out and redirecting to login");
        const authStore = useAuthStore.getState();
        authStore.logout().finally(() => {
          window.location.href = '/';
        });
      }

      return Promise.reject(error);
    }

    console.error("API Error:", error.response?.data || error.message);
    return Promise.reject(error);
  }
);

/**
 * Streaming POST request with ReadableStream support
 * This method uses fetch API to support streaming responses
 * 
 * @param {string} url - The URL to make the request to
 * @param {any} data - The data to send in the request body
 * @param {any} [requestConfig] - Optional request configuration
 * @returns {Promise<{ data: { getReader: () => ReadableStreamDefaultReader<Uint8Array> } }>} - Response with readable stream
 */
apiClient.postStream = async function(url: string, data: any, requestConfig?: any) {
  try {
    // Apply encryption if enabled (same logic as interceptor)
    let encryptedData = data;
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Copy headers from apiClient defaults
    if (apiClient.defaults.headers) {
      const defaultHeaders = apiClient.defaults.headers.common || {};
      Object.entries(defaultHeaders).forEach(([key, value]) => {
        if (typeof value === 'string') {
          headers[key] = value;
        }
      });
    }

    // Apply custom headers from config
    if (requestConfig?.headers) {
      Object.assign(headers, requestConfig.headers);
    }

    // Apply encryption if enabled (check global config)
    if (config.encryption.enabled) {
      const isFormData = data instanceof FormData;
      if (!isFormData && ['post', 'put', 'patch'].includes('post')) {
        // LOG UNENCRYPTED PAYLOAD FOR STREAMING API
        console.log('=== STREAMING API REQUEST PAYLOAD (UNENCRYPTED) ===');
        console.log('URL:', url);
        console.log('Method: POST');
        console.log('Request Body (unencrypted):', JSON.stringify(data, null, 2));
        console.log('==================================================');
        
        encryptedData = encryptPayload(data); 
      }
    } else {
      // Log unencrypted payload when encryption is disabled
      console.log('=== STREAMING API REQUEST PAYLOAD (ENCRYPTION DISABLED) ===');
      console.log('URL:', url);
      console.log('Method: POST');
      console.log('Request Body:', JSON.stringify(data, null, 2));
      console.log('===========================================================');
    }

    // Use fetch for streaming support
    const fullUrl = `${apiClient.defaults.baseURL}${url}`;
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: headers,
      body: typeof encryptedData === 'string' ? encryptedData : JSON.stringify(encryptedData),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error("ReadableStream not supported");
    }

    // Return an object with getReader method to match the expected API
    // This allows res.data.getReader() to work
    return {
      data: {
        getReader: () => response.body!.getReader(),
        body: response.body,
      },
      body: response.body,
    };
  } catch (error) {
    console.error("Streaming request error:", error);
    throw error;
  }
};

export { apiClient };