import { apiClient } from "@/services/apiClient";

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
  sort_ascending: boolean;
}

interface FormData {
  dimensions?: Array<{ id: string; name: string }>;
  x_axis?: XAxisConfig;
  show_legend?: boolean; // Changed to boolean
}

export const createBigNumberRequest = async (
  dataset: string,
  filters: Filter[],
  chartMetric: ChartMetric | null,
  formData: FormData,
  defaultRowLimit: number,
  timeGrain: string
) => {
  const chartRequest = {
    database: "hpcl_ceg",
    schema: "public",
    table: dataset,
    visualization_name: "bignumber",
    organization_id: 6,
    name: "",
    description: "",
    "params": {
      "queries": [
        {
          "filters": filters.map(filter => ({
            col: filter.col,
            op: filter.op,
            val: filter.val ? filter.val.flat() : []
          })),
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
        "x_axis": formData.x_axis ? {
          name: formData.x_axis.name,
          label: formData.x_axis.label || "",
          sort_ascending: formData.x_axis.sort_ascending || false
        } : {},
        "time_grain":timeGrain ,
        "groupby": formData.dimensions?.map(dim => ({
          name: dim.name,
          label: dim.name
        })) || [],
        "query_mode": "",
        "show_legend": formData.show_legend, // Changed to boolean
        "show_data_zoom": '',
        "legend_orientation": '',
        "legend_type": ''
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

  console.log("Big Number API Request Body:", JSON.stringify(chartRequest, null, 2));

  const response = await apiClient.post('/api/charts/chart', chartRequest);
  console.log("Big Number API Response Body:", response.data);
  const organizationId=chartRequest.organization_id;

  if (response.data.status === true && response.data.data) {
    return {
      chartType: 'bignumber',
      chartData: response.data.data,
      chartRequest: chartRequest,
      organizationId

    };
  } else {
    throw new Error("Invalid response format for big number chart");
  }
};