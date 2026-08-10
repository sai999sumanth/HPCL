// SupplyDashboardApi.ts

import { apiClient } from "@/services/apiClient";

interface IndentFilter {
    key: string;
    cond: string;
    value: string;
  }
  
  interface SupplyMetricsResponse {
    indent_not_placed: number;
    indent_on_hold: number;
    indent_in_progress: number;
    dry_out: number;
    total_count: number;
  }
  
  export const fetchSupplyMetrics = async () => {
    try {
      const response = await apiClient.post('/api/indentdryout/get_indent_data', {
          filters: [
            {
              key: "indent_status",
              cond: "equals",
              value: "indent_not_placed"
            }
          ]
        });
  
      if (!response.status) {
        throw new Error('Network response was not ok');
      }
  
      const data: SupplyMetricsResponse = await response.data;
      console.log('API Response:', data); // Debug log
      return data;
  
    } catch (error) {
      console.error('Error fetching supply metrics:', error);
      throw error;
    }
  };