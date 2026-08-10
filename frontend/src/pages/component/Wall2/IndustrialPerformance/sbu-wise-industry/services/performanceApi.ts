import { apiClient } from '@/services/apiClient';
import { ApiPayload, ApiResponse, FilterValues, MonthWiseApiResponse, HistoricalDataApiResponse, FilterItem } from '../types';

export interface HistoricalFilters {
  sbu_name: string;
  coname: string;
  zone_name: string;
  region_name: string;
  statename: string;
  distname: string;
  productname: string[];
}

export const fetchTopPerformers = async (filterValues: FilterValues): Promise<ApiResponse> => { 
  const filters: FilterItem[] = [
    {
      key: "sbu_name",
      cond: "equals",
      value: filterValues.sbu_name
    },
    {
      key: "zone_name",
      cond: "equals",
      value: filterValues.zone_name
    },
    {
      key: "region_name",
      cond: "equals",
      value: filterValues.region_name
    },
    {
      key: "fiscal_year",
      cond: "in",
      value: filterValues.fiscal_year
    },
    {
      key: "productname",
      cond: "in",
      value: filterValues.productname.length > 0 ? filterValues.productname.join(',') : ""
    },
    {
      key: "coname",
      cond: "equals",
      value: filterValues.coname
    },
    {
      key: "distname",
      cond: "equals",
      value: filterValues.distname
    },
    {
      key: "month_name",
      cond: "equals",
      value: filterValues.month_name
    }
  ];

  // Add statename filter if provided
  if (filterValues.statename) {
    filters.push({
      key: "statename",
      cond: "equals",
      value: filterValues.statename
    });
  }

  const payload: ApiPayload = {
    filters: filters,
    cross_filters: [],
    action: "industry_performance",
    drill_state: "",
    time_grain: "",
    resp_format: "top_performers"
  };

  try {
    const response = await apiClient.post('/api/charts/generate_vis_data', payload);
    return response.data;
  } catch (error) {
    console.error('Error fetching top performers:', error);
    throw error;
  }
};

export const fetchBottomPerformers = async (filterValues: FilterValues): Promise<ApiResponse> => { 
  const filters: FilterItem[] = [
    {
      key: "sbu_name",
      cond: "equals",
      value: filterValues.sbu_name
    },
    {
      key: "zone_name",
      cond: "equals",
      value: filterValues.zone_name
    },
    {
      key: "region_name",
      cond: "equals",
      value: filterValues.region_name
    },
    {
      key: "fiscal_year",
      cond: "in",
      value: filterValues.fiscal_year
    },
    {
      key: "productname",
      cond: "in",
      value: filterValues.productname.length > 0 ? filterValues.productname.join(',') : ""
    },
    {
      key: "coname",
      cond: "equals",
      value: filterValues.coname
    },
    {
      key: "distname",
      cond: "equals",
      value: filterValues.distname
    },
    {
      key: "month_name",
      cond: "equals",
      value: filterValues.month_name
    }
  ];

  // Add statename filter if provided
  if (filterValues.statename) {
    filters.push({
      key: "statename",
      cond: "equals",
      value: filterValues.statename
    });
  }

  const payload: ApiPayload = {
    filters: filters,
    cross_filters: [],
    action: "industry_performance",
    drill_state: "",
    time_grain: "",
    resp_format: "bottom_performers"
  };

  try { 
    const response = await apiClient.post('/api/charts/generate_vis_data', payload);
    return response.data;
  } catch (error) { 
    console.error('Error fetching bottom performers:', error);
    throw error;
  }
};

// Updated to fetch all years data for drilldown (empty fiscal year)
export const fetchHistoricalYearsData = async ( 
  regionName?: string, 
  filterValues?: HistoricalFilters
): Promise<HistoricalDataApiResponse> => {
  const filters: FilterItem[] = [
    { key: 'sbu_name', cond: 'equals', value: filterValues?.sbu_name || 'RETAIL' },
    { key: 'coname', cond: 'equals', value: filterValues?.coname || 'HPCL' },
    // Send empty fiscal year to get all years data, then filter to last 3 years client-side
    { key: 'fiscal_year', cond: 'in', value: '' }
  ];
  
  // Add optional filters based on provided filterValues
  if (filterValues?.zone_name) { 
    filters.push({ key: 'zone_name', cond: 'equals', value: filterValues.zone_name });
  }
  if (regionName || filterValues?.region_name) {
    filters.push({ 
      key: 'region_name', 
      cond: 'equals', 
      value: regionName || filterValues.region_name 
    });
  }
  if (filterValues?.statename) {
    filters.push({ key: 'statename', cond: 'equals', value: filterValues.statename });
  }
  if (filterValues?.distname) {
    filters.push({ key: 'distname', cond: 'equals', value: filterValues.distname });
  }
  if (filterValues?.productname && filterValues.productname.length > 0) {
    filters.push({ 
      key: 'productname', 
      cond: 'in', 
      value: filterValues.productname.join(',') 
    });
  }

  const payload: ApiPayload = {
    filters: filters,
    cross_filters: [],
    action: 'industry_performance',
    drill_state: '',
    time_grain: '',
    resp_format: 'historical_years'
  };

  try {
    const response = await apiClient.post('/api/charts/generate_vis_data', payload);
    return response.data;
  } catch (error) {
    console.error('Error fetching historical years data:', error);
    throw error;
  }
};

// Zone-wise performance API call
export const fetchZonewisePerformance = async (filterValues: FilterValues): Promise<any> => {
  const filters: FilterItem[] = [
    {
      key: "\"fiscal_year\"",
      cond: "in",
      value: filterValues.fiscal_year || "2025-2026"
    },
    {
      key: "\"sbu_name\"",
      cond: "equals",
      value: filterValues.sbu_name || "RETAIL"
    },
    {
      key: "\"ind_sbu_cumulative\"",
      cond: "equals",
      value: "true"
    },
    {
      key: "\"coname\"",
      cond: "equals",
      value: filterValues.coname || "HPCL,BPCL,IOCL"
    },
    {
      key: "\"cogroup\"",
      cond: "equals",
      value: "MPSU"
    },
    {
      key: "\"month_name\"",
      cond: "equals",
      value: filterValues.month_name || "APR,MAY,JUN,JUL"
    }
  ];

  const payload: ApiPayload = {
    filters: filters,
    cross_filters: [],
    action: "industry_performance",
    drill_state: "zone_name",
    time_grain: "",
    resp_format: "omc_compare"
  };

  try {
    const response = await apiClient.post('/api/charts/generate_vis_data', payload);
    return response.data;
  } catch (error) {
    console.error('Error fetching zonewise performance:', error);
    throw error;
  }
};

// Company level performance for 6 bar graphs
export const fetchCompanyLevelPerformance = async (filterValues: FilterValues, stateName?: string): Promise<any> => {
  const filters: FilterItem[] = [
    {
      key: "\"A\"",
      cond: "equals",
      value: "true"
    },
    {
      key: "\"H\"",
      cond: "equals",
      value: "true"
    },
    {
      key: "\"YTM\"",
      cond: "equals",
      value: "true"
    },
    {
      key: "\"table\"",
      cond: "equals",
      value: "true"
    },
    {
      key: "\"table_month\"",
      cond: "equals",
      value: filterValues.month_name || "JUL"
    },
    {
      key: "\"cumulative\"",
      cond: "equals",
      value: "True"
    }
  ];

  // Add state filter if provided
  if (stateName) {
    filters.push({
      key: "\"statename\"",
      cond: "equals",
      value: stateName
    });
  }

  const payload: ApiPayload = {
    filters: filters,
    cross_filters: [],
    action: "industry_performance",
    drill_state: "",
    time_grain: "Monthly",
    resp_format: "company_level"
  };

  try {
    const response = await apiClient.post('/api/charts/generate_vis_data', payload);
    return response.data;
  } catch (error) {
    console.error('Error fetching company level performance:', error);
    throw error;
  }
};

// OMC cumulative data for pie charts
export const fetchOMCCumulativeData = async (filterValues: FilterValues): Promise<any> => {
  const filters: FilterItem[] = [
    {
      key: "\"sbu_name\"",
      cond: "equals",
      value: filterValues.sbu_name || "RETAIL"
    },
    {
      key: "\"zone_name\"",
      cond: "equals",
      value: filterValues.zone_name || ""
    },
    {
      key: "\"fiscal_year\"",
      cond: "in",
      value: filterValues.fiscal_year || "2024-2025"
    },
    {
      key: "\"productname\"",
      cond: "equals",
      value: filterValues.productname.length > 0 ? filterValues.productname.join(',') : "CBG,LDO,MS,AUTO LPG,SKO-PDS,CNG,HSD"
    },
    {
      key: "\"month_name\"",
      cond: "equals",
      value: filterValues.month_name || "APR,MAR"
    }
  ];

  const payload: ApiPayload = {
    filters: filters,
    cross_filters: [],
    action: "industry_performance",
    drill_state: "",
    time_grain: "",
    resp_format: "omc_cumulative"
  };

  try {
    const response = await apiClient.post('/api/charts/generate_vis_data', payload);
    return response.data;
  } catch (error) {
    console.error('Error fetching OMC cumulative data:', error);
    throw error;
  }
};

// File download API
export const downloadPerformanceData = async (filterValues: FilterValues): Promise<any> => {
  const filters: FilterItem[] = [
    {
      key: "sbu_name",
      cond: "equals",
      value: filterValues.sbu_name
    },
    {
      key: "zone_name",
      cond: "equals",
      value: filterValues.zone_name
    },
    {
      key: "region_name",
      cond: "equals",
      value: filterValues.region_name
    },
    {
      key: "fiscal_year",
      cond: "in",
      value: filterValues.fiscal_year
    },
    {
      key: "productname",
      cond: "in",
      value: filterValues.productname.length > 0 ? filterValues.productname.join(',') : ""
    },
    {
      key: "coname",
      cond: "equals",
      value: filterValues.coname
    },
    {
      key: "distname",
      cond: "equals",
      value: filterValues.distname
    },
    {
      key: "month_name",
      cond: "equals",
      value: filterValues.month_name
    }
  ];

  // Add statename filter if provided
  if (filterValues.statename) {
    filters.push({
      key: "statename",
      cond: "equals",
      value: filterValues.statename
    });
  }

  const payload: ApiPayload = {
    filters: filters,
    cross_filters: [],
    action: "industry_performance",
    drill_state: "",
    time_grain: "",
    resp_format: "file_download"
  };

  try {
    const response = await apiClient.post('/api/charts/generate_vis_data', payload);
    return response.data;
  } catch (error) {
    console.error('Error downloading performance data:', error);
    throw error;
  }
};