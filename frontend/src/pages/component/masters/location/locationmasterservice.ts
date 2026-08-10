import { apiClient } from '@/services/apiClient';
import axios from 'axios';

export interface LocationMasterResponse {
  data: {
    id: number;
    bu: string;
    sap_id: string;
    name: string;
    address: string;
    city: string;
    state: string;
    region: string;
    district: string;
    latitude: string;
    longitude: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }[];
  total: number;
}

export interface LocationData {
  id: string;
  type: string;
  sapCode: string;
  name: string;
  address: string;
  city: string;
  state: string;
  region: string;
  territory: string;
  latLong: string;
  status: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

const BASE_URL = 'https://algo-ceg-dev.algofusiontech.com/api';

export const LocationMasterService = {
  async getAllLocations(params: {
    q?: string;
    skip?: number;
    limit?: number;
    sort?: string;
    fields?: string;
    view?: string;
  }): Promise<PaginatedResponse<LocationData>> {
    try {
      const response = await apiClient.get<LocationMasterResponse>(`${BASE_URL}/locationmaster`, {
        params: {
          ...params,
          limit: params.limit || 10,
          skip: params.skip || 0
        },
      });

      const mappedData = response.data.data.map((item) => ({
        id: item.id.toString(),
        type: item.bu || '',
        sapCode: item.sap_id,
        name: item.name,
        address: item.address,
        city: item.city,
        state: item.state,
        region: item.region,
        territory: item.district,
        latLong: `${item.latitude},${item.longitude}`,
        status: item.is_active ? 'active' : 'inactive'
      }));

      return {
        data: mappedData,
        total: response.data.total || 0
      };
    } catch (error) {
      console.error('Error fetching locations:', error);
      throw error;
    }
  },

  async createLocation(locationData: Partial<LocationData>) {
    try {
      const response = await apiClient.post(`${BASE_URL}/locationmaster`, locationData);
      return response.data;
    } catch (error) {
      console.error('Error creating location:', error);
      throw error;
    }
  },

  async updateLocation(id: string, locationData: Partial<LocationData>) {
    try {
      const response = await apiClient.put(`${BASE_URL}/locationmaster/${id}`, locationData);
      return response.data;
    } catch (error) {
      console.error('Error updating location:', error);
      throw error;
    }
  },

  async deleteLocation(id: string) {
    try {
      const response = await apiClient.delete(`${BASE_URL}/locationmaster/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting location:', error);
      throw error;
    }
  },

  async uploadCsv(formData: FormData) {
    try {
      const response = await apiClient.post(
        `${BASE_URL}/locationmaster/upload_location_master`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'accept': 'application/json'
          }
        }
      );
      
      if (Array.isArray(response.data) && response.data.length === 2) {
        return {
          success: response.data[0],
          message: response.data[1]
        };
      }
      
      throw new Error('Unexpected response format');
    } catch (error) {
      console.error('Error uploading CSV:', error);
      throw error;
    }
  },

  async downloadTemplate() {
    try {
      const response = await apiClient.post(`http://localhost:5200/api/locationmaster/download_template`, {}, {
        responseType: 'blob',
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error downloading template:', error);
      throw error;
    }
  },

  async downloadCsv() {
    try {
      const response = await apiClient.post<{
        status: boolean;
        message: string;
        data: string;
      }>(`http://localhost:5200/api/locationmaster/download_location_master`, {});

      if (!response.data.status || !response.data.data) {
        throw new Error('Failed to get download path');
      }

      // Get the file content using the path
      const fileResponse = await apiClient.get(`http://localhost:5200${response.data.data}`, {
        responseType: 'arraybuffer',
        headers: {
          'Content-Type': 'application/octet-stream',
        }
      });

      return {
        data: fileResponse.data,
        success: true,
        message: 'File fetched successfully'
      };

    } catch (error) {
      console.error('Error downloading CSV:', error);
      throw error;
    }
  }
};