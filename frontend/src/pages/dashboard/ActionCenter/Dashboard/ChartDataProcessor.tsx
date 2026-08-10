import { createPieChart } from "../_Chart/ChartRequests/PieChartRequest";
import { createBigNumberRequest } from "../_Chart/ChartRequests/BigNumberChartRequest";
import { createTableRequest } from "../_Chart/ChartRequests/TableRequest";
import { createAreaChartRequest } from "../_Chart/ChartRequests/AreaChartRequest";
import { createLineChartRequest } from "../_Chart/ChartRequests/LineChartRequest";
import { createBarChartRequest } from "../_Chart/ChartRequests/BarChartRequest";
import { createGaugeChart } from "../_Chart/ChartRequests/GaugeChartRequest";
import { createTimeSeriesBarChartRequest } from "../_Chart/ChartRequests/TimeSeriesBarChartRequest";
import { createStackedBarChartRequest } from "../_Chart/ChartRequests/StackedBarChartRequest";
import { createDonutChart } from "../_Chart/ChartRequests/DonutChartRequest";

export const processChartData = async (chartRequest: any, vizType: string) => {
  let processedChartData;

  switch (vizType.toLowerCase()) {
    case "pie":
      processedChartData = await createPieChart(
        chartRequest.table,
        chartRequest.params.queries[0].filters,
        chartRequest.params.queries[0].metrics[0],
        {
          dimensions: chartRequest.params.form_data.groupby.map((dim) => ({
            id: dim.name,
            name: dim.name,
          })),
        },
        chartRequest.params.queries[0].row_limit,
        chartRequest.params.form_data.show_legend,
        chartRequest.params.form_data.legend_orientation || "top",
        chartRequest.params.form_data.legend_type || "scroll"
      );
      break;
      case "gauge": 
        processedChartData = await createGaugeChart(
          chartRequest.table,                                
          chartRequest.params.queries[0].filters,               
          chartRequest.params.queries[0].metrics[0] || null,    
          {
            dimensions: chartRequest.params.form_data.groupby?.map((dim) => ({
              id: dim.name,
              name: dim.name,
              label: dim.label
            })) || [],
       
          },
          chartRequest.params.queries[0].row_limit || 100,      
          chartRequest.params.form_data.show_legend || false,    
          chartRequest.params.form_data.legend_orientation || "horizontal",  
          chartRequest.params.form_data.legend_type || "scroll" , 
          chartRequest.params.form_data.maxValue
        );
        break;
      case "donut":
        processedChartData = await createDonutChart(
          chartRequest.table,
          chartRequest.params.queries[0].filters,
          chartRequest.params.queries[0].metrics[0],
          {
            dimensions: chartRequest.params.form_data.groupby.map((dim) => ({
              id: dim.name,
              name: dim.name,
            })),
          },
          chartRequest.params.queries[0].row_limit,
          chartRequest.params.form_data.show_legend,
          chartRequest.params.form_data.legend_orientation || "top",
          chartRequest.params.form_data.legend_type || "scroll"
        );
        break;
    case "bar":
      processedChartData = await createBarChartRequest(
        chartRequest.table,
        chartRequest.params.queries[0].filters,
        chartRequest.params.queries[0].metrics[0] || null,
        {
          dimensions: chartRequest.params.form_data.groupby?.map((dim) => ({
            id: dim.name,
            name: dim.name,
          })) || [],
          x_axis: chartRequest.params.form_data.x_axis || {},
        },
        chartRequest.params.queries[0].row_limit || 100,
        chartRequest.params.form_data.time_grain, 
        chartRequest.params.form_data.show_legend || false,
        chartRequest.params.form_data.show_data_zoom || false,
        chartRequest.params.form_data.legend_orientation || "horizontal",
        chartRequest.params.form_data.legend_type || "scroll"
      );
      break;
      case "stacked_bar":
      processedChartData = await createStackedBarChartRequest(
        chartRequest.table,
        chartRequest.params.queries[0].filters,
        chartRequest.params.queries[0].metrics[0] || null,
        {
          dimensions: chartRequest.params.form_data.groupby?.map((dim) => ({
            id: dim.name,
            name: dim.name,
          })) || [],
          x_axis: chartRequest.params.form_data.x_axis || {},
        },
        chartRequest.params.queries[0].row_limit || 100,
        chartRequest.params.form_data.time_grain, 
        chartRequest.params.form_data.show_legend || false,
        chartRequest.params.form_data.show_data_zoom || false,
        chartRequest.params.form_data.legend_orientation || "horizontal",
        chartRequest.params.form_data.legend_type || "scroll"
      );
      break;
      case "custom_stacked_bar":
        processedChartData = await createStackedBarChartRequest(
          chartRequest.table,
          chartRequest.params.queries[0].filters,
          chartRequest.params.queries[0].metrics[0] || null,
          {
            dimensions: chartRequest.params.form_data.groupby?.map((dim) => ({
              id: dim.name,
              name: dim.name,
            })) || [],
            x_axis: chartRequest.params.form_data.x_axis || {},
          },
          chartRequest.params.queries[0].row_limit || 100,
          chartRequest.params.form_data.time_grain, 
          chartRequest.params.form_data.show_legend || false,
          chartRequest.params.form_data.show_data_zoom || false,
          chartRequest.params.form_data.legend_orientation || "horizontal",
          chartRequest.params.form_data.legend_type || "scroll"
        );
        break;
      case "custom_bar":
      processedChartData = await createBarChartRequest(
        chartRequest.table,
        chartRequest.params.queries[0].filters,
        chartRequest.params.queries[0].metrics[0] || null,
        {
          dimensions: chartRequest.params.form_data.groupby?.map((dim) => ({
            id: dim.name,
            name: dim.name,
          })) || [],
          x_axis: chartRequest.params.form_data.x_axis || {},
        },
        chartRequest.params.queries[0].row_limit || 100,
        chartRequest.params.form_data.time_grain, 
        chartRequest.params.form_data.show_legend || false,
        chartRequest.params.form_data.show_data_zoom || false,
        chartRequest.params.form_data.legend_orientation || "horizontal",
        chartRequest.params.form_data.legend_type || "scroll"
      );
      break;
    case "bignumber":
      processedChartData = await createBigNumberRequest(
        chartRequest.table,
        chartRequest.params.queries[0].filters,
        chartRequest.params.queries[0].metrics[0] || null,
        {
          dimensions: chartRequest.params.form_data.groupby?.map((dim) => ({
            id: dim.name,
            name: dim.name,
          })) || [],
          x_axis: chartRequest.params.form_data.x_axis || {},
        },
        chartRequest.params.queries[0].row_limit || 1,
        chartRequest.params.form_data.time_grain, 

      );
      break;
    case "line":
      processedChartData = await createLineChartRequest(
        chartRequest.table,
        chartRequest.params.queries[0].filters,
        chartRequest.params.queries[0].metrics[0] || null,
        {
          dimensions: chartRequest.params.form_data.groupby?.map((dim) => ({
            id: dim.name,
            name: dim.name,
            label: dim.label
          })) || [],
          x_axis: chartRequest.params.form_data.x_axis || {},
        },
        chartRequest.params.queries[0].row_limit || 100,
        chartRequest.params.form_data.time_grain, 
        chartRequest.params.form_data.show_legend || false,
        chartRequest.params.form_data.legend_orientation || "horizontal",
        chartRequest.params.form_data.legend_type || "scroll"
      );
      break;
      case "area": {
        processedChartData = await createAreaChartRequest(
          chartRequest.table,
          chartRequest.params.queries[0].filters,
          chartRequest.params.queries[0].metrics[0] || null,
          {
            dimensions: chartRequest.params.form_data.groupby?.map((dim) => ({
              id: dim.name,
              name: dim.name,
              label: dim.label  
            })) || [],
            x_axis: chartRequest.params.form_data.x_axis || {},  
          },
          chartRequest.params.queries[0].row_limit || 100,
          chartRequest.params.form_data.time_grain,
          chartRequest.params.form_data.show_legend || false,
          chartRequest.params.form_data.legend_orientation || "horizontal",
          chartRequest.params.form_data.legend_type || "scroll",
          chartRequest.params.form_data.show_data_zoom || false,
        );
        break;
      }
    case "table":
      processedChartData = await createTableRequest(
        chartRequest.table,
        chartRequest.params.queries[0].filters,
        chartRequest.params.queries[0].metrics[0] || null,
        {
          dimensions: chartRequest.params.form_data.groupby?.map((dim) => ({
            id: dim.name,
            name: dim.name,
          })) || [],
        },
        chartRequest.params.queries[0].row_limit || 100,
        chartRequest.params.form_data.time_grain, 
        chartRequest.params.form_data.show_legend || false,
        chartRequest.params.form_data.legend_orientation || "horizontal",
        chartRequest.params.form_data.legend_type || "scroll"
      );
      break;
      case "time_series_bar":
        processedChartData = await createTimeSeriesBarChartRequest(
          chartRequest.table,
        chartRequest.params.queries[0].filters,
        chartRequest.params.queries[0].metrics[0] || null,
        {
          dimensions: chartRequest.params.form_data.groupby?.map((dim) => ({
            id: dim.name,
            name: dim.name,
          })) || [],
          x_axis: chartRequest.params.form_data.x_axis || {},
        },
        chartRequest.params.queries[0].row_limit || 100,
        chartRequest.params.form_data.time_grain, 
        chartRequest.params.form_data.show_legend || false,
        chartRequest.params.form_data.show_data_zoom || false,
        chartRequest.params.form_data.legend_orientation || "horizontal",
        chartRequest.params.form_data.legend_type || "scroll"
        );
        break;
    default:
      console.warn(`Unsupported chart type: ${vizType}. Skipping chart preparation.`);
      return null;
  }

  return processedChartData;
};