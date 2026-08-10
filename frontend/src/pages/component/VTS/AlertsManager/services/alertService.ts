import { apiClient } from "@/services/apiClient";

interface Filter {
  key: string;
  cond: string;
  value: string;
}

interface AlertsRequest {
  filters: Filter[];
}

interface AlertsResponse {
  data: any[];
  total: number;
  page: number;
  limit: number;
}

const USE_MOCK_API = true; // Set to false when you have a real API

export const alertService = {
  async getAlerts(filters: Filter[]): Promise<AlertsResponse> {
    if (USE_MOCK_API) {
      console.log('Using mock API service with filters:', filters);
    //   return mockAlertService.getAlerts(filters);
    }

    try {
      const requestData: AlertsRequest = {
        filters: filters
      };
      
      const url = '/api/alerts/vts_alert_manager';
      console.log('Making API request to:', url);
      console.log('Request data:', JSON.stringify(requestData, null, 2));
      
      const response = await apiClient.post(url, requestData);
      
      // For client-side pagination, we expect the full dataset.
      const allData = response.data.data || [];
      return {
        data: allData,
        total: allData.length,
        page: 1,
        limit: allData.length,
      };
    } catch (error) {
      console.error('Error fetching alerts:', error);
      
      // Fallback to mock service if API fails
      console.log('API failed, falling back to mock service');
    //   return mockAlertService.getAlerts(filters);
    }
  }
};
