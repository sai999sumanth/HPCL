
import { apiClient } from '@/services/apiClient';
import axios from 'axios';

interface ChartMetric {
  expression_type?: string;
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

interface FormData {
  dimensions?: Array<{ id: string; name: string; alias: string }>;
}

export const createGaugeChart = async (
  dataset: string,
  filters: Filter[],
  chartMetric: ChartMetric | null,
  formData: FormData,
  defaultRowLimit: number,
  showLegend: boolean,
  legendOrientation: string,
  legendType: string,
  drilldownFilters: Filter[] = [] // New parameter for drilldown filters
) => {
  // Combine base filters with drilldown filters
  const combinedFilters = [...filters, ...drilldownFilters];

  const chartRequest = {
    "database": "hpcl_ceg",
    "schema": "public",
    "table": dataset,
    "visualization_name": "gauge",
    "organization_id": 6,
    "name": "Gauge Chart",
    "description": "",
    "params": {
      "queries": [
        {
          "filters": combinedFilters.map(filter => ({
            col: filter.col,
            op: filter.op,
            val: filter.val ? filter.val.flat() : []
          })),
          "columns": [],
          "metrics": chartMetric ? [chartMetric] : [],
          "orderby": chartMetric ? [
            {
              "order_by": false,
              ...chartMetric
            }
          ] : [],
          "row_limit": defaultRowLimit,
          "series_columns": [],
          "series_limit": 0,
          "order_descending": false
        }
      ],
      "form_data": {
        "x_axis": {},
        "metrics": [],
        "groupby": formData.dimensions?.map(dim => ({
          name: dim.name,
          label: dim.alias
        })) || [],
        "order_descending": true,
        "row_limit": defaultRowLimit,
        "show_legend": showLegend,
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
    "created_by": "Manual",
    "hashed_value": ""
  };

  console.log("API Request Body:", JSON.stringify(chartRequest, null, 2));

  const response = await apiClient.post('/api/charts/chart', chartRequest);
  console.log("API Response Body:", response.data);
  const organizationId = chartRequest.organization_id;

  if (response.data.status === true && response.data.data) {
    return {
      chartType: 'gauge',
      chartData: response.data.data,
      chartRequest: chartRequest,
      showLegend,
      legendOrientation,
      legendType,
      organizationId
    };
  } else {
    throw new Error("Invalid response format");
    
  }
};