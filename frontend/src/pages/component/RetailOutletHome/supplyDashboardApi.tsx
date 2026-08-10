// services/supplyDashboardApi.js

import { apiClient } from "@/services/apiClient";

export const fetchSupplyMetrics = async (filters) => {
    try {
      const response = await apiClient.post('/api/indentdryout/get_indent_analysis', {filters});
      
      if (!response.status) {
        throw new Error('Network response was not ok');
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching supply metrics:', error);
      throw error;
    }
  };
  
  export const getRequestFilters = (page, tab) => {
    const baseFilters = [];
    
    if (page === 0) {
      baseFilters.push({ key: "model", cond: "=", value: "all" });
    } else if (page === 1) {
      baseFilters.push({ key: "model", cond: "=", value: "pending_indents" });
    } else if (page === 2) {
      baseFilters.push({ key: "model", cond: "=", value: "indents_not_placed" });
    }
  
    if (tab === "cat_a") {
      baseFilters.push({ key: "category", cond: "=", value: "cat_a" });
    } else if (tab === "full_dry_out") {
      baseFilters.push({ key: "category", cond: "=", value: "full_dry_out" });
    }
  
    return baseFilters;
  };