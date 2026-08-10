import { apiClient } from "@/services/apiClient";
import axios from "axios";

interface DateFilter {
  key: 'created_at';
  cond: 'date_range' | 'date_filter';
  value: string;
}

interface LocationFilter {
  zone?: string;
  plant?: string;
}

export const fetchTerminalData = async (
  action: string,
  bu: string,
  alert_section?: string,
  alert_status: string = 'Open', // Default to 'Open' if not provided
  timeFilter?: string | DateFilter,
  condition: 'equals' | 'not_equals' = 'equals',
  locationFilter?: LocationFilter
) => {
  try {
    const filters = [
      {
        key: 'bu',
        cond: 'equals',
        value: bu
      },
      ...(alert_section
        ? [{
            key: 'alert_section',
            cond: condition,
            value: alert_section
          }]
        : []),
      {
        key: 'alert_status',
        cond: 'equals',
        value: alert_status // Use the provided alert_status instead of hardcoding 'Open'
      }
    ];
    
    // Add zone filter if provided
    if (locationFilter?.zone) {
      filters.push({
        key: 'zone',
        cond: 'equals',
        value: locationFilter.zone
      });
    }
    
    // Add plant filter if provided
    if (locationFilter?.plant) {
      filters.push({
        key: 'sap_id',
        cond: 'equals',
        value: locationFilter.plant
      });
    }
    
    // Handle both timeFilter types
    if (timeFilter) {
      if (typeof timeFilter === 'string') {
        // Handle standard time filters (t, 1d, 1w, etc.)
        filters.push({
          key: 'created_at',
          cond: 'date_filter',
          value: timeFilter
        });
      } else {
        // Handle custom date range filter
        filters.push(timeFilter);
      }
    }
    
    const response = await apiClient.post('/api/charts/generate_vis_data', {
      filters: filters,
      action: action,
      drill_state: ''
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching data for ${bu}:`, error);
    throw error;
  }
};