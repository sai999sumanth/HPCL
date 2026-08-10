// Utility function to unwrap API responses
export function unwrapApiResponse<T>(responseData: any, actionName: string): T {
  try {
    // Handle different response structures
    if (responseData?.data) {
      return responseData.data;
    }
    
    if (responseData?.result) {
      return responseData.result;
    }
    
    // Return the response data as-is if no wrapper is found
    return responseData;
  } catch (error) {
    console.error(`[unwrapApiResponse:${actionName}] Error unwrapping response:`, error);
    throw new Error(`[${actionName}] Failed to unwrap API response`);
  }
}

// Type definitions for API requests and responses
export interface LocationMasterRequest {
  bu: string;
  zone: string[];
  plant: string[];
}

export interface LocationDetailsApiResponse {
  zones?: string[];
  plant?: string[];
  // Add other possible response fields here
}
