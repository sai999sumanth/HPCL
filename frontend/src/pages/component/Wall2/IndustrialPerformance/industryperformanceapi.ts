import { apiClient } from "@/services/apiClient";

// api/industryService.ts
export const fetchIndustryData = async () => {
    const requestBody = {
      filters: [],
      cross_filters: [],
      action: "industry_performance",
      drill_state: "",
      time_grain: "",
      resp_format: "omc_cumulative"
    };
  
    try {
      const response = await apiClient.post('/api/charts/generate_vis_data', requestBody)
  
      if (!response.status) {
        throw new Error('Network response was not ok');
      }
  
      return await response.data;
    } catch (error) {
      throw new Error(`Failed to fetch industry data: ${error.message}`);
    }
  };
export interface IndustryDataResponse {
    message: string;
    status: boolean;
    data: {
      month_name: Record<string, string>;
      company: string[];
      [key: string]: any; // This allows for dynamic company share data
    }
  }
  
  interface FilterPayload {
    key: string;
    cond: string;
    value: string;
  }
  
  interface RequestPayload {
    filters: FilterPayload[];
    cross_filters: any[];
    action: string;
    drill_state: string;
    time_grain: string;
    resp_format: string;
  }
  
  export const fetchIndustryAreaChartData = async (isCompanyLevel: boolean = false) => {
    const companyLevelPayload: RequestPayload = {
      filters: [
        { key: '"A"', cond: "equals", value: "true" },
        { key: '"H"', cond: "equals", value: "true" },
        { key: '"C"', cond: "equals", value: "true" }
      ],
      cross_filters: [],
      action: "industry_performance",
      drill_state: "",
      time_grain: "Monthly",
      resp_format: "company_level"
    };
  
    const cumulativePayload: RequestPayload = {
      filters: [
        { key: '"A"', cond: "equals", value: "true" },
        { key: '"H"', cond: "equals", value: "true" },
        { key: '"YTM"', cond: "equals", value: "true" },
        { key: '"inc"', cond: "equals", value: "true" }
      ],
      cross_filters: [],
      action: "industry_performance",
      drill_state: "",
      time_grain: "Monthly",
      resp_format: "company_level"
    };
  
    try {
      const response = await apiClient.post('/api/charts/generate_vis_data', isCompanyLevel ? companyLevelPayload : cumulativePayload);
  
      if (!response.status) {
        throw new Error('Network response was not ok');
      }
  
      return await response.data;
    } catch (error) {
      throw new Error(`Failed to fetch industry data: ${error.message}`);
    }
  };

  export const fetchSbuLevelHeatmapData = async () => {
    try {
      const response = await apiClient.post('/api/charts/generate_vis_data', {
          filters: [
            { key: '"A"', cond: "equals", value: "true" },
            { key: '"H"', cond: "equals", value: "true" },
            { key: '"company_name"', cond: "equals", value: "hpcl" }
          ],
          cross_filters: [],
          action: "industry_performance",
          drill_state: "",
          time_grain: "Monthly",
          resp_format: "company_level_heatmap",
          resp_level: "sbu_level"
        })
      
      if (!response.status) {
        throw new Error('Failed to fetch SBU level heatmap data');
      }
      
      const result = await response.data;
      return result.data;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch SBU level heatmap data');
    }
  };
  export const fetchProductLevelHeatmapData = async () => {
    try {
      const response = await apiClient.post('/api/charts/generate_vis_data', {
          filters: [
            { key: '"A"', cond: "equals", value: "true" },
            { key: '"H"', cond: "equals", value: "true" },
            { key: '"company_name"', cond: "equals", value: "hpcl" }
          ],
          cross_filters: [],
          action: "industry_performance",
          drill_state: "",
          time_grain: "Monthly",
          resp_format: "company_level_heatmap",
          resp_level: "product_level"
        })
      
      if (!response.status) {
        throw new Error('Failed to fetch SBU level heatmap data');
      }
      
      const result = await response.data;
      return result.data;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch SBU level heatmap data');
    }
  };