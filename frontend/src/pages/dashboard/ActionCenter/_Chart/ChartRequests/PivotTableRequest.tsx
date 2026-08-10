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

interface FormData {
  dimensions?: Array<{ id: string; name: string }>;
}

export const createPivotTableRequest = async (
  dataset: string,
  filters: Filter[],
  chartMetric: ChartMetric | null,
  formData: FormData,
  defaultRowLimit: number,
  timeGrain: string,
  showLegend: boolean,
  legendOrientation: string,
  legendType: string
) => {
  const chartRequest = {
    "database": "hpcl_ceg",
    "schema": "public",
    "table": dataset,
    "visualization_name": "pivot",
    "oraganization_id": 6,
    "name": "Pivot Table Visualization",
    "description": "",
    "params": {
      "queries": [
        {
          "filters": filters.map(filter => ({
            col: filter.col,
            op: filter.op,
            val: filter.val ? filter.val.flat() : []
          })),
          "columns": [],
          "metrics": chartMetric ? [chartMetric] : [],
          "orderby": chartMetric ? [
            {
              "order_by": true,
              ...chartMetric
            }
          ] : [],
          "row_limit": defaultRowLimit,
          "series_columns": [],
          "series_limit": 0,
          "order_descending": true
        }
      ],
      "form_data": {
        "x_axis": {},
        "metrics": [],
        "time_grain": timeGrain,

        "groupby": formData.dimensions?.map(dim => ({
          name: dim.name,
          label: dim.name
        })) || [],
        "order_descending": false,
        "query_mode": "aggregate",
        "row_limit": defaultRowLimit,
        "show_legend": showLegend,
        "legend_orientation": legendOrientation,
        "legend_type": legendType
      }
    }
  };

  console.log("Pivot Table Chart API Request Body:", JSON.stringify(chartRequest, null, 2));

  const response = await apiClient.post('/api/charts/chart', chartRequest);
  console.log("Pivot Table Chart API Response Body:", response.data);
  const organizationId=chartRequest.oraganization_id;

  if (response.data.status === true && response.data.data) {
    return {
      chartType: 'pivot',
      chartData: response.data.data,
      chartRequest: chartRequest,
      showLegend,
      legendOrientation,
      legendType,
      organizationId
    };
  } else {
    throw new Error("Invalid response format for pivot table chart");
  }
};