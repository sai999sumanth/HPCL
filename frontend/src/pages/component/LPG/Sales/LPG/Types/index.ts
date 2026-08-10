// src/types/index.ts

// --- Core Application Types ---

// Represents a single manufacturing plant, used throughout the app
export interface Plant {
  id: string; 
  name: string;
  sap_id: number;
  location: string;
}

// A type alias to resolve import errors in the usePlantLocations hook.
export type PlantLocation = Plant;

export type DatePreset = 'today' | 'yesterday' | '1w' | '15d' | '1m' | null;

// This interface is now simplified as state is managed separately.
// It's used for prop types where multiple filters are passed together.
export interface DashboardFilters {
  plantId: string | null;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  activePreset: DatePreset;
}


// --- Rejection Data Types ---

// Represents the data for a single rejection metric card (e.g., rejection rate, trend)
export interface CardMetricData {
  current: number;       // The current rejection rate
  previous: number;      // The rejection rate from the previous period
  percentage: number;    // The percentage change between periods
  trend: 'up' | 'down' | 'stable'; // The direction of the trend
}

// Represents the detailed breakdown of rejection reasons from the API
export interface RejectionBreakdown {
  handled: number;
  sortout: number;
  cylinder_filled: number;
  negative_tare: number;
  other_errors: number;
  overfilled: number;
  positive_tare: number;
  rejection_rate: number;
  timeout: number;
  underfilled: number;
  commErrorSortout: number;
}

// Combines card metric data with the detailed breakdown for a full picture
export interface RejectionCategoryData extends CardMetricData, RejectionBreakdown {
  error?: boolean; // Add an optional error flag for individual metric failures.
}

// The final shape of all rejection data returned by the useRejectionData hook
export interface AllRejectionData {
  cs: RejectionCategoryData;
  gd: RejectionCategoryData;
  pt: RejectionCategoryData;
}

// This new type represents the processed data for a single carousel.
export interface SingleCSRejectionData extends RejectionCategoryData {
  carouselId: string;
}


// --- Productivity Data Types ---

// Represents productivity data for a single shift type from the API
export interface ProductivityShiftData {
  net_hours: number;
  total_production: number;
  productivity: number;
  gaps?: number;
}

// The raw productivity data for a single carousel from the API
export interface CarouselProductivityData {
  first_cylinder?: string | null;
  last_cylinder?: string | null;
  bottling_hours?: number;
  stoppage_hours?: number;
  net_bottling_hours?: number;
  normal?: ProductivityShiftData;
  overtime?: ProductivityShiftData;
  break?: ProductivityShiftData;
}

// The raw total productivity data from the API
export interface TotalProductivityData {
  first_cylinder?: string | null;
  last_cylinder?: string | null;
  bottling_hours?: number;
  stoppage_hours?: number;
  net_bottling_hours?: number;
  total_production?: number;
  total_productivity?: number;
}

// The raw productivity data structure from the API
export interface ProductivityApiResponse {
  [key: string]: CarouselProductivityData | TotalProductivityData;
  total?: TotalProductivityData;
}

// Represents a single row in the new productivity table, derived from the API response
export interface ProductivityTableRow {
  shift: 'Normal' | 'Overtime' | 'Break';
  net_hours: number;
  total_production: number;
  productivity: number;
}

// This new type represents the processed multi-carousel data returned by the hook.
export interface ProcessedProductivityData {
  [carouselId: string]: CarouselProductivityData;
  total?: TotalProductivityData;
}


// --- Bottling Summary Types ---

// This is the data structure for a single group (e.g., "Production 14.2kg") in the chart.
export interface GroupedBottlingChartData {
  name: string; // e.g., "Production 14.2kg"
  // It will have dynamic keys for each carousel, e.g., "Carousel 1": 44972
  [carouselKey: string]: string | number;
}

// This is the processed data returned by the hook.
export interface ProcessedBottlingData {
  chartData: GroupedBottlingChartData[];
  carouselKeys: string[]; // e.g., ["Carousel 1", "Carousel 2"]
}


// --- Filling Accuracy Types ---

// The processed data structure now includes a systemId for identification.
export interface FillingAccuracyData {
  systemId: number;
  accuracy_rate: number;
  total_filled: number;
  average_variance: number;
  breakdown: {
    on_target: number;
    var_0_50: number;
    var_50_100: number;
    var_100_plus: number;
  };
}

// --- Hourly Production Types ---
export interface CarouselTotal {
  carouselName: string;
  total: number;
}

// THE FIX: The type has been renamed to match the import in the hook.
export interface GroupedShiftChartData {
  shift: 'Normal' | 'Break' | 'Overtime';
  [carouselKey: string]: string | number;
}

export interface ProcessedHourlyProductionData {
  // THE FIX: This now uses the new, renamed type.
  chartData: GroupedShiftChartData[];
  carouselKeys: string[];
  carouselTotals: CarouselTotal[];
}
