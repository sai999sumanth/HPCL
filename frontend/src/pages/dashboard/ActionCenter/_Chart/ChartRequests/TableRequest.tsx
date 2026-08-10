import { apiClient } from '@/services/apiClient';
import axios from 'axios';

interface ChartMetrics {
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

// interface FormData {
//     dimensions?: Array<{ column: string }>;
//     metrics?: Array<{ column: string; aggregate: string }>;
//     orderBy?: Array<{ column: string; descending: boolean }>;
//   }

interface FormData {
  dimensions?: Array<{ id: string; name: string ;alias:string}>;
}

export const createTableRequest = async (
  dataset: string,
  filters: Filter[],
  chartMetrics: ChartMetrics[] | ChartMetrics | null, // Updated to handle array or single metric
  formData: FormData,
  defaultRowLimit: number,
  timeGrain: string,
  showLegend: boolean,
  legendOrientation: string,
  legendType: string
) => {// Convert chartMetrics to array if it's a single metric
  const metricsArray = chartMetrics 
    ? Array.isArray(chartMetrics) 
      ? chartMetrics 
      : [chartMetrics]
    : [];

  // Ensure we have at least one metric
  if (metricsArray.length === 0) {
    throw new Error("At least one metric is required for area chart");
  }

  const chartRequest = {
    "database": "hpcl_ceg",
    "schema": "public",
    "table": dataset,
    "visualization_name": "Table",
    "organization_id": 6,
    "name": "Table Visualization",
    "description": "",
    "params": {
      "queries": [
        {
          "filters": filters.map(filter => ({
            col: filter.col,
            op: filter.op,
            val: filter.val ? filter.val.flat() : [] // Flatten the val array
          })),
          "columns": [],
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
        "x_axis": {},
        "metrics": [],
        "time_grain": timeGrain,

        "groupby": formData.dimensions?.map(dim => ({
          name: dim.name,
          label: dim.alias
        })) || [],
        "order_descending": false,
        "row_limit": defaultRowLimit,
        "show_legend": showLegend,
        "legend_orientation": legendOrientation,
        "legend_type": legendType
      }
    }
  };

  console.log("Table Chart API Request Body:", JSON.stringify(chartRequest, null, 2));

  const response = await apiClient.post('/api/charts/chart', chartRequest);
  console.log("Table Chart API Response Body:", response.data);
  const organizationId=chartRequest.organization_id;

  if (response.data.status === true && response.data.data) {
    return {
      chartType: 'table',
      chartData: response.data.data,
      chartRequest: chartRequest,
      showLegend,
      legendOrientation,
      legendType,
      organizationId
    };
  } else {
    throw new Error("Invalid response format for table chart");
  }
};
