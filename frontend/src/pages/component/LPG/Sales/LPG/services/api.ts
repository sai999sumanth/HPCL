import { apiClient } from '@/services/apiClient';
import type {
  LocationMasterRequest,
  RejectionDataRequest,
  RejectionData,
  CSRejectionResponse,
  ProductivityResponse,
  BottlingSummaryResponse,
  FillingAccuracyResponse,
  HourlyProductionResponse,
} from '../Types/api';

/** Response from get_eld_drill_down: total_sortout, breakdown (Leak, Others, etc.), and bar data per group */
export type EldDrillDownResponse = Record<string, unknown> & {
  total_sortout?: number;
  sortout?: number;
};

/** Response from get_old_drill_down: total_sortout, breakdown (Leak, No Connect, etc.), and bar data per group */
export type OldDrillDownResponse = Record<string, unknown> & {
  total_sortout?: number;
  sortout?: number;
};

const unwrapApiResponse = <T>(responseData: any, actionName: string): T => {
  if (!responseData) {
    throw new Error(`[${actionName}] API returned an empty or null response.`);
  }

  // THE FIX: This new check handles the specific [false, "message"] error format.
  if (Array.isArray(responseData) && responseData.length === 2 && responseData[0] === false) {
    throw new Error(responseData[1] || `[${actionName}] API returned a failure array.`);
  }

  // Handle the standard wrapper: { status: boolean, data: {...}, message: string }
  if (typeof responseData.status === 'boolean') {
    if (responseData.status === true) {
      if ('data' in responseData) {
        return responseData.data as T;
      }
      return {} as T; 
    } else {
      throw new Error(responseData.message || `[${actionName}] API request returned a failure status.`);
    }
  }

  // If there's no wrapper, assume the response is the data itself.
  return responseData as T;
};

/**
 * A helper function to safely parse rejection data fields.
 * This converts any string numbers from the API into actual numbers.
 * @param data The raw data object for a rejection category.
 * @returns A clean RejectionData object with all fields as numbers.
 */
const parseRejectionNumbers = (data: any): RejectionData => {
  const safeParse = (value: any): number => {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  };

  return {
    handled: safeParse(data.handled),
    cylinder_filled: safeParse(data.cylinder_filled),
    underfilled: safeParse(data.underfilled),
    overfilled: safeParse(data.overfilled),
    negative_tare: safeParse(data.negative_tare),
    positive_tare: safeParse(data.positive_tare),
    timeout: safeParse(data.timeout),
    other_errors: safeParse(data.other_errors),
    sortout: safeParse(data.sortout),
    commErrorSortout: safeParse(data.commErrorSortout),
    rejection_rate: safeParse(data.rejection_rate),
  };
};


class ApiService {
  /**
   * Fetches the list of distinct locations, plants, etc.
   */
  async getDistLocDetails(payload: LocationMasterRequest, signal?: AbortSignal): Promise<any[]> {
    const actionName = 'getDistLocDetails';
    try {
      const response = await apiClient.post<any>('/api/charts/generate_vis_data', payload, { signal });
      const unwrappedData = unwrapApiResponse<any>(response.data, actionName);

      if (!Array.isArray(unwrappedData?.plant)) {
        throw new Error(`[${actionName}] Invalid data structure: 'plant' property is not an array.`);
      }
      return unwrappedData.plant;

    } catch (error: any) {
      if (error.name !== 'CanceledError') {
        console.error(`[ApiService:${actionName}] API Error:`, error);
      }
      throw error;
    }
  }

  /**
   * Fetches rejection data for GD and PT metrics.
   */
  private async getStandardRejectionData(payload: RejectionDataRequest, signal?: AbortSignal): Promise<RejectionData> {
    const actionName = payload.action;
    try {
      const response = await apiClient.post<any>('/api/charts/generate_vis_data', payload, { signal });
      let responseData = response.data;
      if (!responseData) {
        throw new Error(`[${actionName}] API returned no data.`);
      }
      if (Array.isArray(responseData) && responseData.length === 2 && responseData[0] === false) {
        throw new Error(responseData[1]);
      }
      if ('status' in responseData && 'data' in responseData && typeof responseData.data === 'object' && responseData.data !== null) {
        responseData = responseData.data;
      }
      // Handle both single-object and multi-carousel object shapes
      if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
        // Detect multi-carousel shape: values are objects with handled/sortout
        const values = Object.values(responseData) as Array<Record<string, any>>;
        const looksLikeCarouselObject = values.length > 0 && values.every((v) => typeof v === 'object' && v !== null && ('handled' in v || 'sortout' in v));
        if (looksLikeCarouselObject) {
          const totals = values.reduce(
            (acc: { handled: number; sortout: number }, rec: Record<string, any>) => {
              acc.handled += Number(rec?.handled) || 0;
              acc.sortout += Number(rec?.sortout) || 0;
              return acc;
            },
            { handled: 0, sortout: 0 }
          );
          const aggregated = {
            handled: totals.handled,
            sortout: totals.sortout,
            rejection_rate: totals.handled > 0 ? (totals.sortout / totals.handled) * 100 : 0,
            cylinder_filled: 0,
            underfilled: 0,
            overfilled: 0,
            negative_tare: 0,
            positive_tare: 0,
            timeout: 0,
            other_errors: 0,
            commErrorSortout: 0,
          };
          return parseRejectionNumbers(aggregated);
        }
      }
      return parseRejectionNumbers(responseData);
    } catch (error: any) {
       if (error.name !== 'CanceledError') {
        console.error(`[ApiService:${actionName}] API Error:`, error);
      }
      throw error;
    }
  }

  /**
   * Fetches data specifically for the CS Rejection card.
   */
  async getCSRejectionCard(fromDate: string, toDate: string, sapId: number, signal?: AbortSignal): Promise<RejectionData> {
    const payload: RejectionDataRequest = {
      action: "get_cs_rejection_card",
      payload: { from_date: fromDate, to_date: toDate, sap_id: sapId }
    };
    return this.getStandardRejectionData(payload, signal);
  }

  /**
   * Fetches CS Rejection data for the chart, which has a unique carousel-based structure.
   */
  async getCSRejection(fromDate: string, toDate: string, sapId: number, signal?: AbortSignal): Promise<CSRejectionResponse> {
    const actionName = "get_cs_rejection";
    const payload: RejectionDataRequest = { action: actionName, payload: { from_date: fromDate, to_date: toDate, sap_id: sapId } };
    
    try {
      const response = await apiClient.post<any>('/api/charts/generate_vis_data', payload, { signal });
      const unwrappedData = unwrapApiResponse<CSRejectionResponse>(response.data, actionName);

      // if (typeof unwrappedData !== 'object' || unwrappedData === null || Object.keys(unwrappedData).length === 0) {
      //   throw new Error(`[${actionName}] Invalid data format: expected a non-empty object.`);
      // }
      
      return unwrappedData;

    } catch (error: any)
    {
      if (error.name !== 'CanceledError') {
        console.error(`[ApiService:${actionName}] API Error:`, error);
      }
      throw error;
    }
  }

  /**
   * Fetches productivity data, which can be nested under multiple dynamic keys (carousels).
   */
  async getProductivity(fromDate: string, toDate: string, sapId: number, signal?: AbortSignal): Promise<ProductivityResponse> {
    const actionName = "get_productivity";
    const payload: RejectionDataRequest = { action: actionName, payload: { from_date: fromDate, to_date: toDate, sap_id: sapId } };
    
    try {
      const response = await apiClient.post<any>('/api/charts/generate_vis_data', payload, { signal });
      const unwrappedData = unwrapApiResponse<ProductivityResponse>(response.data, actionName);
      
      if (typeof unwrappedData !== 'object' || unwrappedData === null || Object.keys(unwrappedData).length === 0) {
        throw new Error(`[${actionName}] Productivity data is empty or invalid.`);
      }
      
      return unwrappedData;
    } catch (error: any) {
      if (error.name !== 'CanceledError') {
        console.error(`[ApiService:${actionName}] API Error:`, error);
      }
      throw error;
    }
  }

  /**
   * Fetches bottling summary data, which contains multiple carousels.
   */
  async getBottlingSummary(fromDate: string, toDate: string, sapId: number, signal?: AbortSignal): Promise<BottlingSummaryResponse> {
    const actionName = "get_bottling_summary";
    const payload: RejectionDataRequest = { action: actionName, payload: { from_date: fromDate, to_date: toDate, sap_id: sapId } };
    
    try {
      const response = await apiClient.post<any>('/api/charts/generate_vis_data', payload, { signal });
      const unwrappedData = unwrapApiResponse<BottlingSummaryResponse>(response.data, actionName);

      // if (typeof unwrappedData !== 'object' || unwrappedData === null || Object.keys(unwrappedData).length === 0) {
      //   throw new Error(`[${actionName}] API returned invalid or empty data for bottling summary.`);
      // }

      return unwrappedData;
    } catch (error: any) {
      if (error.name !== 'CanceledError') {
        console.error(`[ApiService:${actionName}] API Error:`, error);
      }
      throw error;
    }
  }

  /**
   * Fetches filling accuracy data, which is returned as an array.
   */
  async getFillingAccuracy(fromDate: string, toDate: string, sapId: number, signal?: AbortSignal): Promise<FillingAccuracyResponse> {
    const actionName = "get_filling_accuracy";
    const payload: RejectionDataRequest = { action: actionName, payload: { from_date: fromDate, to_date: toDate, sap_id: sapId } };
    
    try {
      const response = await apiClient.post<any>('/api/charts/generate_vis_data', payload, { signal });
      const unwrappedData = unwrapApiResponse<FillingAccuracyResponse>(response.data, actionName);

      // if (!Array.isArray(unwrappedData)) {
      //    throw new Error(`[${actionName}] Invalid data structure: expected an array.`);
      // }
      return unwrappedData;
    } catch (error: any) {
      if (error.name !== 'CanceledError') {
        console.error(`[ApiService:${actionName}] API Error:`, error);
      }
      throw error;
    }
  }
  
  /**
   * Fetches hourly production data.
   */
  async getHourlyProduction(sapId: number, signal?: AbortSignal): Promise<HourlyProductionResponse> {
    const actionName = "get_hourly_production";
    const payload: RejectionDataRequest = { action: actionName, payload: { sap_id: sapId } };
    
    try {
      const response = await apiClient.post<any>('/api/charts/generate_vis_data', payload, { signal });
      const unwrappedData = unwrapApiResponse<HourlyProductionResponse>(response.data, actionName);

      // if (typeof unwrappedData !== 'object' || unwrappedData === null || Object.keys(unwrappedData).length === 0) {
      //   throw new Error(`[${actionName}] API returned invalid or empty data.`);
      // }

      return unwrappedData;
    } catch (error: any) {
      if (error.name !== 'CanceledError') {
        console.error(`[ApiService:${actionName}] API Error:`, error);
      }
      throw error;
    }
  }

  /**
   * Fetches total productivity (today) data for the Productivity card on Production Dashboard.
   * Calls /api/charts/generate_vis_data with action "get_total_productivity_today_data".
   * Response shape: { "Productivity": number }
   */
  async getTotalProductivityTodayData(
    fromDate: string,
    toDate: string,
    sapId: number,
    signal?: AbortSignal
  ): Promise<{ Productivity: number }> {
    const actionName = 'get_total_productivity_today_data';
    const payload = {
      action: actionName,
      payload: { from_date: fromDate, to_date: toDate, sap_id: sapId },
    };
    try {
      const response = await apiClient.post<any>('/api/charts/generate_vis_data', payload, { signal });
      return unwrapApiResponse<{ Productivity: number }>(response.data, actionName);
    } catch (error: any) {
      if (error.name !== 'CanceledError') {
        console.error(`[ApiService:${actionName}] API Error:`, error);
      }
      throw error;
    }
  }

  /**
   * Fetches total production (today) data for the Production card on Production Dashboard.
   * Calls /api/charts/generate_vis_data with action "get_total_production_today_data".
   * Response shape: { "Total Production": number }
   */
  async getTotalProductionTodayData(
    fromDate: string,
    toDate: string,
    sapId: number,
    signal?: AbortSignal
  ): Promise<{ 'Total Production': number }> {
    const actionName = 'get_total_production_today_data';
    const payload = {
      action: actionName,
      payload: { from_date: fromDate, to_date: toDate, sap_id: sapId },
    };
    try {
      const response = await apiClient.post<any>('/api/charts/generate_vis_data', payload, { signal });
      return unwrapApiResponse<{ 'Total Production': number }>(response.data, actionName);
    } catch (error: any) {
      if (error.name !== 'CanceledError') {
        console.error(`[ApiService:${actionName}] API Error:`, error);
      }
      throw error;
    }
  }

  /**
   * Fetches productivity history (line chart). No date filter is sent to the API.
   * Calls /api/charts/generate_vis_data with action "get_productivity_history".
   * Response: { labels: string[], overall: { c1, c2, ... }, c1_rate: number[], c2_rate?: number[], ... }
   */
  async getProductivityHistory(
    sapId: number,
    signal?: AbortSignal
  ): Promise<{ labels: string[]; overall: Record<string, number>; [key: string]: string[] | Record<string, number> | number[] | undefined }> {
    const actionName = 'get_productivity_moving_average';
    const payload = {
      action: actionName,
      payload: { sap_id: sapId },
    };
    try {
      const response = await apiClient.post<any>('/api/charts/generate_vis_data', payload, { signal });
      const unwrapped = unwrapApiResponse<{ labels?: string[]; overall?: Record<string, number>; [key: string]: any }>(response.data, actionName);
      if (!unwrapped || typeof unwrapped !== 'object') {
        return { labels: [], overall: {} };
      }
      const labels = Array.isArray(unwrapped.labels) ? unwrapped.labels : [];
      const overall = unwrapped.overall && typeof unwrapped.overall === 'object' ? unwrapped.overall : {};
      const result: { labels: string[]; overall: Record<string, number>; [key: string]: string[] | Record<string, number> | number[] | undefined } = { labels, overall } as { labels: string[]; overall: Record<string, number>; [key: string]: string[] | Record<string, number> | number[] | undefined };
      Object.keys(unwrapped).forEach((key) => {
        if (key !== 'labels' && key !== 'overall' && Array.isArray(unwrapped[key])) {
          result[key] = unwrapped[key] as number[];
        }
      });
      return result;
    } catch (error: any) {
      if (error.name !== 'CanceledError') {
        console.error(`[ApiService:${actionName}] API Error:`, error);
      }
      throw error;
    }
  }

  /**
   * ELD drill down: stacked bar chart data (total_sortout, breakdown, bars per group).
   * Action: get_eld_drill_down.
   */
  async getEldDrillDown(
    fromDate: string,
    toDate: string,
    sapId: number,
    signal?: AbortSignal
  ): Promise<EldDrillDownResponse> {
    const actionName = 'get_eld_drill_down';
    const payload = {
      action: actionName,
      payload: { from_date: fromDate, to_date: toDate, sap_id: sapId },
    };
    try {
      const response = await apiClient.post<any>('/api/charts/generate_vis_data', payload, { signal });
      const unwrapped = unwrapApiResponse<EldDrillDownResponse>(response.data, actionName);
      return unwrapped && typeof unwrapped === 'object' ? unwrapped : {};
    } catch (error: any) {
      if (error.name !== 'CanceledError') {
        console.error(`[ApiService:${actionName}] API Error:`, error);
      }
      throw error;
    }
  }

  /** ELD & OLD rejections: { ELD: { "1": { handled, sortout, rejection_rate } }, OLD: { ... } } */
  async getEldOldRejections(
    fromDate: string,
    toDate: string,
    sapId: number,
    signal?: AbortSignal
  ): Promise<{ ELD?: Record<string, { handled: number; sortout: number; rejection_rate: number }>; OLD?: Record<string, { handled: number; sortout: number; rejection_rate: number }> }> {
    const actionName = 'get_eld_old_rejections';
    const payload = {
      action: actionName,
      payload: { from_date: fromDate, to_date: toDate, sap_id: sapId },
    };
    try {
      const response = await apiClient.post<any>('/api/charts/generate_vis_data', payload, { signal });
      const unwrapped = unwrapApiResponse<{ ELD?: Record<string, { handled: number; sortout: number; rejection_rate: number }>; OLD?: Record<string, { handled: number; sortout: number; rejection_rate: number }> }>(response.data, actionName);
      if (!unwrapped || typeof unwrapped !== 'object') return {};
      return unwrapped;
    } catch (error: any) {
      if (error.name !== 'CanceledError') {
        console.error(`[ApiService:${actionName}] API Error:`, error);
      }
      throw error;
    }
  }

  /**
   * OLD drill down: stacked bar chart data (total_sortout, breakdown by reason, bars per group).
   * Action: get_old_drill_down.
   */
  async getOldDrillDown(
    fromDate: string,
    toDate: string,
    sapId: number,
    signal?: AbortSignal
  ): Promise<OldDrillDownResponse> {
    const actionName = 'get_old_drill_down';
    const payload = {
      action: actionName,
      payload: { from_date: fromDate, to_date: toDate, sap_id: sapId },
    };
    try {
      const response = await apiClient.post<any>('/api/charts/generate_vis_data', payload, { signal });
      const unwrapped = unwrapApiResponse<OldDrillDownResponse>(response.data, actionName);
      return unwrapped && typeof unwrapped === 'object' ? unwrapped : {};
    } catch (error: any) {
      if (error.name !== 'CanceledError') {
        console.error(`[ApiService:${actionName}] API Error:`, error);
      }
      throw error;
    }
  }

  /** Underperforming scales: payload { time, sap_id } only (no date range). */
  async getUnderPerformanceScales(
    sapId: number,
    time: string,
    signal?: AbortSignal
  ): Promise<{ rows: Array<{ scale: number; carousal: number; efficiency: number; efficiency_display: string; tag: string; count: number }>; meta?: { car1Eff?: string; car2Eff?: string } }> {
    const actionName = 'under_performance_scales';
    const payload = {
      action: actionName,
      payload: { time, sap_id: sapId },
    };
    try {
      const response = await apiClient.post<any>('/api/charts/generate_vis_data', payload, { signal });
      const unwrapped = unwrapApiResponse<{ rows?: any[]; meta?: Record<string, string> }>(response.data, actionName);
      const rows = Array.isArray(unwrapped?.rows) ? unwrapped.rows : [];
      const meta = unwrapped?.meta ?? {};
      return { rows, meta };
    } catch (error: any) {
      if (error.name !== 'CanceledError') {
        console.error(`[ApiService:${actionName}] API Error:`, error);
      }
      throw error;
    }
  }

  /** Underfill & overfill scales: payload { time, sap_id } only (no date range). */
  async getUnderfillOverfillScales(
    sapId: number,
    time: string,
    signal?: AbortSignal
  ): Promise<{ rows: Array<{ scale: number; carousal: number; accuracy?: number; accuracy_display?: string; tag?: string; count?: number }>; meta?: Record<string, string> }> {
    const actionName = 'underfill_overfill_scales';
    const payload = {
      action: actionName,
      payload: { time, sap_id: sapId },
    };
    try {
      const response = await apiClient.post<any>('/api/charts/generate_vis_data', payload, { signal });
      const unwrapped = unwrapApiResponse<{ rows?: any[]; meta?: Record<string, string> }>(response.data, actionName);
      const rows = Array.isArray(unwrapped?.rows) ? unwrapped.rows : [];
      const meta = unwrapped?.meta ?? {};
      return { rows, meta };
    } catch (error: any) {
      if (error.name !== 'CanceledError') {
        console.error(`[ApiService:${actionName}] API Error:`, error);
      }
      throw error;
    }
  }

  getGDRejection(fromDate: string, toDate: string, sapId: number, signal?: AbortSignal) {
    const payload: RejectionDataRequest = {
      action: "get_gd_rejection",
      payload: { from_date: fromDate, to_date: toDate, sap_id: sapId }
    };
    return this.getStandardRejectionData(payload, signal);
  }

  getPTRejection(fromDate: string, toDate: string, sapId: number, signal?: AbortSignal) {
    const payload: RejectionDataRequest = {
      action: "get_pt_rejection",
      payload: { from_date: fromDate, to_date: toDate, sap_id: sapId }
    };
    return this.getStandardRejectionData(payload, signal);
  }
}

export const apiService = new ApiService();
