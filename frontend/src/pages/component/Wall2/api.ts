import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";

interface ChartDataParams {
    filters: Array<{ key: string; cond: string; value: string }>;
    cross_filters?: Array<{ key: string; cond: string; value: string }>;
    action: string;
    drill_state: string;
    time_grain?: string;
    resp_format?: string;
    resp_level?: string;
    sbu_wise?: boolean;
  }
  
  interface DistinctValuesParams {
    connection_id: string;
    schema: string;
    table: string;
    column: string[];
    where_cond: any[]
  }
  
  export const fetchChartData = async (params: ChartDataParams) => {
    const response = await apiClient.post('/api/charts/generate_vis_data', params);
  
    if (!response.status) {
      toast.error(response.statusText, {
        className: 'my-classname',
        description: response.status,
        duration: 5000,
      });
      console.log(response);
    }
  
    return response.data;
  };
  
  export const fetchDistinctValues = async (params: DistinctValuesParams) => {
    const response = await apiClient.post('/api/charts/get_distinct_values', params);
  
    if (!response.status) {
      toast.error(response.statusText, {
        className: 'my-classname',
        description: response.status,
        duration: 5000,
      });
      throw new Error('Network response was not ok');
    }
  
    return response.data;
  };

  export const fetchProductValues = async (params: DistinctValuesParams) => {
    const response = await apiClient.post('/api/charts/get_product_values', params);
  
    if (!response.status) {
      toast.error(response.statusText, {
        className: 'my-classname',
        description: response.status,
        duration: 5000,
      });
      throw new Error('Network response was not ok');
    }
  
    return response.data;
  };
  
  