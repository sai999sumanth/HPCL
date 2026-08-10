

import { apiClient } from '@/services/apiClient';
import axios from 'axios';

interface ChartMetric {
  expression_type: string;
  column: {
    column_name: string;
    type: string;
  };
  aggregate: string;
  label: string;
}

interface Filter {
  col?: string;
  op?: string;
  val?: string[];
}

interface XAxisConfig {
  name: string;
  label: string;
  type?: string;
  alias:string;
  sort_ascending: boolean;
}

interface FormData {
  dimensions?: Array<{ id: string; name: string;alias:string }>;
  x_axis?: XAxisConfig;
}

export const createTimeSeriesLineChartRequest = async (
  dataset: string,
  filters: Filter[],
  chartMetrics: ChartMetric[] | ChartMetric | null, // Updated to handle array or single metric
  formData: FormData,
  defaultRowLimit: number,
  timeGrain: string,
  showLegend: boolean,
  showDataZoom: boolean,
  legendOrientation: string,
  legendType: string
) => {
  // Convert chartMetrics to array if it's a single metric
  const metricsArray = chartMetrics 
    ? Array.isArray(chartMetrics) 
      ? chartMetrics 
      : [chartMetrics]
    : [];

  // Ensure we have at least one metric
  if (metricsArray.length === 0) {
    throw new Error("At least one metric is required for line chart");
  }

  const chartRequest = {
    "database": "hpcl_ceg",
    "schema": "public",
    "table": dataset,
    "visualization_name": "time_series_line",
    "organization_id": 6,
    "name": "Time Series Line Chart",
    "description": "",
    "params": {
      "queries": [
        {
          "filters": filters.map(filter => ({
            col: filter.col,
            op: filter.op,
            val: filter.val ? filter.val.flat() : []
          })),
          "metrics": metricsArray,
          "orderby": metricsArray.map(metric => ({
            order_by: false,
            ...metric
          })),
          "row_limit": defaultRowLimit,
          "series_columns": [],
          "series_limit": 0,
          "order_descending": false
        }
      ],
      "form_data": {
        "x_axis": formData.x_axis ? {
          name: formData.x_axis.name,
          label: formData.x_axis.alias || formData.x_axis.name,
          type:formData.x_axis.type,
          sort_ascending: formData.x_axis.sort_ascending || false
        } : {},
        "time_grain":timeGrain,
        "groupby": formData.dimensions?.map(dim => ({
          name: dim.name,
          label: dim.alias
        })) || [],
        "query_mode": "",
        "show_legend": showLegend,
        "show_data_zoom": showDataZoom,
        "legend_orientation": legendOrientation,
        "legend_type": legendType
      }
    },
    "tags": [
      {
        "name": "",
        "value": ""
      }
    ],
    "group_id": 0,
    "group_name": "",
    "type": "Manual",
    "user_query": "",
    "user_ai_text": "",
    "created_by": "",
    "hashed_value": ""
  };

  try {
    console.log("API Request Body:", JSON.stringify(chartRequest, null, 2));
    const response = await apiClient.post('/api/charts/chart', chartRequest);
    const organizationId=chartRequest.organization_id;

    if (response.data.status === true && response.data.data) {
      return {
        chartType: 'time_series_line',
        chartData: response.data.data,
        chartRequest: chartRequest,
        showLegend,
        showDataZoom,
        legendOrientation,
        legendType,
        organizationId
      };
    } else {
      throw new Error("Invalid response format");
    }
  } catch (error) {
    console.error("Error creating line chart:", error);
    throw error;
  }
};