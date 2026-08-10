// src/types/api.ts

// This file centralizes all type definitions related to API communication.

// --- Location Master Types ---
export interface LocationMasterRequest {
  bu: string;
  zone: string[];
  plant: string[];
}

export interface LocationMasterResponse {
  status: boolean;
  message: string;
  data: any;
}


// --- Rejection Data Types ---
export interface RejectionDataRequest {
  action: string;
  payload: {
    // THE FIX: Date fields are now optional to support date-agnostic calls.
    from_date?: string;
    to_date?: string;
    sap_id: number;
  };
}

// Represents the raw data structure for a single rejection category from the API
export interface RejectionData {
  sortout: number;
  rejection_rate: number;
  handled: number;
  commErrorSortout: number;
  cylinder_filled: number;
  negative_tare: number;
  other_errors: number;
  overfilled: number;
  positive_tare: number;
  timeout: number;
  underfilled: number;
}

// Specific types for the nested structure of the CS Rejection response
export interface CSRejectionCarouselData extends RejectionData {}

export interface CSRejectionResponse {
  [carouselId: string]: CSRejectionCarouselData;
}

export interface NestedCSRejectionResponse {
  status: boolean;
  data: CSRejectionResponse;
}

// Type for the nested structure of standard (GD, PT) rejection responses
export interface NestedRejectionResponse {
  status: boolean;
  data: RejectionData;
}


// --- Productivity Data Types ---
export interface ProductivityShiftData {
  net_hours: number;
  total_production: number;
  productivity: number;
  gaps?: number;
}

// This is the shape of the core productivity data object for a carousel
export interface ProductivityCarouselData {
  first_cylinder?: string | null;
  last_cylinder?: string | null;
  bottling_hours?: number;
  stoppage_hours?: number;
  net_bottling_hours?: number;
  normal?: ProductivityShiftData;
  overtime?: ProductivityShiftData;
  break?: ProductivityShiftData;
}

// This is the shape of the total productivity data
export interface ProductivityTotalData {
  first_cylinder?: string | null;
  last_cylinder?: string | null;
  bottling_hours?: number;
  stoppage_hours?: number;
  net_bottling_hours?: number;
  total_production?: number;
  total_productivity?: number;
}

// Represents the entire productivity API response
export interface ProductivityResponse {
  [key: string]: ProductivityCarouselData | ProductivityTotalData;
  total?: ProductivityTotalData;
}


// --- Bottling Summary Types ---
// THE FIX: The response type is updated to handle multiple carousels.

// This represents the data for a single carousel.
export interface BottlingCarouselData {
  carousal?: number | string;
  [key: string]: number | string | undefined; // For keys like "production_14_2"
}

// The raw response is an object of carousels, keyed by their ID.
export interface BottlingSummaryResponse {
  [carouselId: string]: BottlingCarouselData;
}


// --- Filling Accuracy Types ---
// This is the new raw data structure from the get_filling_accuracy action.
export interface FillingAccuracyRawData {
  system_id: number;
  sap_id: number;
  nil_var: number;
  zero_fifty: number;
  fifty_hundred: number;
  hundred_plus: number;
  average: number;
  count: number;
  stddev: number;
}

// The API returns this as an array, potentially nested.
export type FillingAccuracyResponse = FillingAccuracyRawData[];

// --- Hourly Production Types ---
// THE FIX: The response type is updated to match the new data structure.
export interface HourlyProductionData {
  normal: ProductivityShiftData;
  break: ProductivityShiftData;
  overtime: ProductivityShiftData;
}
export interface HourlyProductionResponse {
  [carouselId: string]: HourlyProductionData;
}


// --- General API Error Type ---
export interface APIError {
  message: string;
  status?: number;
  code?: string;
}
