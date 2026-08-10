// import { createAreaChartRequest } from '../ChartRequests/AreaChartRequest';
// import { createBarChartRequest } from '../ChartRequests/BarChartRequest';
// import { createBigNumberRequest } from '../ChartRequests/BigNumberChartRequest';
// import { createCustomBarChartRequest } from '../ChartRequests/CustomBarChartRequest';
// import { createDonutChart } from '../ChartRequests/DonutChartRequest';
// import { createGaugeChart } from '../ChartRequests/GaugeChartRequest';
// import { createLineChartRequest } from '../ChartRequests/LineChartRequest';
// import { createPieChart } from '../ChartRequests/PieChartRequest';
// import { createPivotTableRequest } from '../ChartRequests/PivotTableRequest';
// import { createStackedBarChartRequest } from '../ChartRequests/StackedBarChartRequest';
// import { createTableRequest } from '../ChartRequests/TableRequest';
// import { createTimeSeriesBarChartRequest } from '../ChartRequests/TimeSeriesBarChartRequest';
// import { Dimension } from './types';  // Assuming you have types defined

// interface ChartHandlerProps {
//   dataset: any;
//   filters: any;
//   chartMetric: any;
//   chartMetrics: any[];
//   formData: any;
//   columns: any[];
//   activeChartType: string;
//   defaultRowLimit: number;
//   timeGrain: string; // Add this line
//   showLegend: boolean;
//   showDataZoom: boolean;
//   legendOrientation: string;
//   legendType: string;
//   showLabelLines: boolean;
// }

// export const createChart = async ({
//   dataset,
//   filters,
//   chartMetric,
//   chartMetrics,
//   formData,
//   columns,
//   activeChartType,
//   defaultRowLimit,
//   timeGrain,
//   showLegend,
//   showDataZoom,
//   legendOrientation,
//   legendType,
//   showLabelLines
// }: ChartHandlerProps) => {
//   let chartData;

//   const dimensionsWithType = (formData.dimensions as Dimension[])?.map(
//     (dim) => ({
//       ...dim,
//       type: columns.find((col) => col.name === dim.name)?.type,
//     })
//   );

//   switch (activeChartType) {
//     case "pie":
//       chartData = await createPieChart(
//         dataset,
//         filters,
//         chartMetric,
//         { dimensions: dimensionsWithType },
//         defaultRowLimit,
//         showLegend,
//         legendOrientation,
//         legendType
//       );
//       break;

//     case "donut":
//       chartData = await createDonutChart(
//         dataset,
//         filters,
//         chartMetric,
//         { dimensions: dimensionsWithType },
//         defaultRowLimit,
//         showLegend,
//         legendOrientation,
//         legendType
//       );
//       break;

//     case "gauge":
//       chartData = await createGaugeChart(
//         dataset,
//         filters,
//         chartMetric,
//         { dimensions: dimensionsWithType },
//         defaultRowLimit,
//         showLegend,
//         legendOrientation,
//         legendType
//       );
//       break;

//     case "bar":
//       if (!chartMetrics) {
//         throw new Error("Please select at least one metric for the bar chart");
//       }
      
//       chartData = await createBarChartRequest(
//         dataset,
//         filters,
//         chartMetrics,
//         {
//           dimensions: formData.dimensions,
//           x_axis: formData["x_axis"],
//         },
//         defaultRowLimit,
//         timeGrain.toLowerCase(),
//         showLegend,
//         showDataZoom,
//         legendOrientation,
//         legendType
//       );
//       break;
//       case "stacked_bar":
//         if (!chartMetrics) {
//           throw new Error("Please select at least one metric for the bar chart");
//         }
        
//         chartData = await createStackedBarChartRequest(
//           dataset,
//           filters,
//           chartMetrics,
//           {
//             dimensions: formData.dimensions,
//             x_axis: formData["x_axis"],
//           },
//           defaultRowLimit,
//           timeGrain.toLowerCase(),
//           showLegend,
//           showDataZoom,
//           legendOrientation,
//           legendType
//         );
//         break;
//     case "time_series_bar":
//       chartData = await createTimeSeriesBarChartRequest(
//         dataset,
//         filters,
//         chartMetrics,
//         {
//           dimensions: formData.dimensions,
//           x_axis: formData["x_axis"],
//         },
//         defaultRowLimit,
//         timeGrain.toLowerCase(),
//         showLegend,
//         showDataZoom,
//         legendOrientation,
//         legendType
//       );
//       break;

//     case "custom_bar":
//       chartData = await createCustomBarChartRequest(
//         dataset,
//         filters,
//         chartMetrics,
//         {
//           dimensions: formData.dimensions,
//           x_axis: formData["x_axis"],
//         },
//         defaultRowLimit,
//         timeGrain.toLowerCase(),
//         showLegend,
//         showDataZoom,
//         legendOrientation,
//         legendType,
//       );
//       break;

//     case "line":
//       if (!chartMetrics) {
//         throw new Error("Please select at least one metric for the line chart");
//       }
      
//       if (!formData["x-axis"]?.name) {
//         throw new Error("Please configure the x-axis for the line chart");
//       }
      
//       chartData = await createLineChartRequest(
//         dataset,
//         filters,
//         chartMetrics,
//         {
//           dimensions: formData.dimensions,
//           x_axis: formData["x-axis"],
//         },
//         defaultRowLimit,
//         timeGrain.toLowerCase(),
//         showLegend,
//         showDataZoom,
//         legendOrientation,
//         legendType
//       );
//       break;

//     case "area":
//       chartData = await createAreaChartRequest(
//         dataset,
//         filters,
//         chartMetrics,
//         {
//           dimensions: formData.dimensions,
//           x_axis: formData["x_axis"],
//         },
//         defaultRowLimit,
//         timeGrain.toLowerCase(),
//         showLegend,
//         showDataZoom,
//         legendOrientation,
//         legendType
//       );
//       break;

//     case "table":
//       chartData = await createTableRequest(
//         dataset,
//         filters,
//         chartMetrics,
//         {
//           dimensions: formData.dimensions,
//         },
//         defaultRowLimit,
//         timeGrain.toLowerCase(),
//         showLegend,
//         legendOrientation,
//         legendType
//       );
//       break;

//     case "pivot_table":
//       chartData = await createPivotTableRequest(
//         dataset,
//         filters,
//         chartMetric,
//         {
//           dimensions: formData.dimensions,
//         },
//         defaultRowLimit,
//         timeGrain.toLowerCase(),
//         showLegend,
//         legendOrientation,
//         legendType
//       );
//       break;

//     case "big_number":
//       chartData = await createBigNumberRequest(
//         dataset,
//         filters,
//         chartMetric,
//         {
//           dimensions: formData.dimensions,
//           x_axis: formData["x_axis"],
//         },
//         defaultRowLimit,
//         timeGrain.toLowerCase()
//       );
//       break;

//     default:
//       throw new Error("Unsupported chart type: " + activeChartType);
//   }

//   return {
//     ...chartData,
//     showLegend,
//     legendOrientation,
//     legendType,
//     showDataZoom,
//     showLabelLines,
//   };
// };

import { createAreaChartRequest } from '../ChartRequests/AreaChartRequest';
import { createBarChartRequest } from '../ChartRequests/BarChartRequest';
import { createBigNumberRequest } from '../ChartRequests/BigNumberChartRequest';
import { createCustomBarChartRequest } from '../ChartRequests/CustomBarChartRequest';
import { createCustomStackedBarChartRequest } from '../ChartRequests/CustomStackedBarChartRequest';
import { createDonutChart } from '../ChartRequests/DonutChartRequest';
import { createGaugeChart } from '../ChartRequests/GaugeChartRequest';
import { createLineChartRequest } from '../ChartRequests/LineChartRequest';
import { createPieChart } from '../ChartRequests/PieChartRequest';
import { createPivotTableRequest } from '../ChartRequests/PivotTableRequest';
import { createStackedBarChartRequest } from '../ChartRequests/StackedBarChartRequest';
import { createTableRequest } from '../ChartRequests/TableRequest';
import { createTimeSeriesBarChartRequest } from '../ChartRequests/TimeSeriesBarChartRequest';
import { createTimeSeriesLineChartRequest } from '../ChartRequests/TimeSeriesLineChartRequest';
import { Dimension } from './types';  // Assuming you have types defined

interface ChartHandlerProps {
  dataset: any;
  filters: any;
  chartMetric: any;
  chartMetrics: any[];
  formData: any;
  columns: any[];
  activeChartType: string;
  defaultRowLimit: number;
  defaultTimeGrain: string; // Add this line
  showLegend: boolean;
  showDataZoom: boolean;
  legendOrientation: string;
  legendType: string;
  showLabelLines: boolean;
}

export const createChart = async ({
  dataset,
  filters,
  chartMetric,
  chartMetrics,
  formData,
  columns,
  activeChartType,
  defaultRowLimit,
  defaultTimeGrain,
  showLegend,
  showDataZoom,
  legendOrientation,
  legendType,
  showLabelLines
}: ChartHandlerProps) => {
  let chartData;
  console.log("formdata", formData)
  const dimensionsWithType = (formData.dimensions as Dimension[])?.map(
    (dim) => ({
      id: dim.id,
      name: dim.name,
      alias: dim.alias ? dim.alias : dim.name // dim.label, // Add this line
    })
  );
  switch (activeChartType) {
    case "pie":
      chartData = await createPieChart(
        dataset,
        filters,
        chartMetric,
        { dimensions: dimensionsWithType },
        defaultRowLimit,
        showLegend,
        legendOrientation,
        legendType
      );
      break;

    case "donut":
      chartData = await createDonutChart(
        dataset,
        filters,
        chartMetric,
        { dimensions: dimensionsWithType },
        defaultRowLimit,
        showLegend,
        legendOrientation,
        legendType
      );
      break;

    case "gauge":
      chartData = await createGaugeChart(
        dataset,
        filters,
        chartMetric,
        { dimensions: dimensionsWithType },
        defaultRowLimit,
        showLegend,
        legendOrientation,
        legendType
      );
      break;

    case "bar":
      if (!chartMetrics) {
        throw new Error("Please select at least one metric for the bar chart");
      }
      
      chartData = await createBarChartRequest(
        dataset,
        filters,
        chartMetrics,
        {
          dimensions: formData.dimensions,
          x_axis: formData["x_axis"],
        },
        defaultRowLimit,
        defaultTimeGrain.toLowerCase(),
        showLegend,
        showDataZoom,
        legendOrientation,
        legendType
      );
      break;
      case "stacked_bar":
        if (!chartMetrics) {
          throw new Error("Please select at least one metric for the bar chart");
        }
        
        chartData = await createStackedBarChartRequest(
          dataset,
          filters,
          chartMetrics,
          {
            dimensions: formData.dimensions,
            x_axis: formData["x_axis"],
          },
          defaultRowLimit,
          defaultTimeGrain.toLowerCase(),
          showLegend,
          showDataZoom,
          legendOrientation,
          legendType
        );
        break;
        case "custom_stacked_bar":
          if (!chartMetrics) {
            throw new Error("Please select at least one metric for the bar chart");
          }
          
          chartData = await createCustomStackedBarChartRequest(
            dataset,
            filters,
            chartMetrics,
            {
              dimensions: formData.dimensions,
              x_axis: formData["x_axis"],
            },
            defaultRowLimit,
            defaultTimeGrain.toLowerCase(),
            showLegend,
            showDataZoom,
            legendOrientation,
            legendType
          );
          break;
    case "time_series_bar":
      chartData = await createTimeSeriesBarChartRequest(
        dataset,
        filters,
        chartMetrics,
        {
          dimensions: formData.dimensions,
          x_axis: formData["x_axis"],
        },
        defaultRowLimit,
        defaultTimeGrain.toLowerCase(),
        showLegend,
        showDataZoom,
        legendOrientation,
        legendType
      );
      break;
      case "time_series_line":
        chartData = await createTimeSeriesLineChartRequest(
          dataset,
          filters,
          chartMetrics,
          {
            dimensions: formData.dimensions,
            x_axis: formData["x_axis"],
          },
          defaultRowLimit,
          defaultTimeGrain.toLowerCase(),
          showLegend,
          showDataZoom,
          legendOrientation,
          legendType
        );
        break;
    case "custom_bar":
      chartData = await createCustomBarChartRequest(
        dataset,
        filters,
        chartMetrics,
        {
          dimensions: formData.dimensions,
          x_axis: formData["x_axis"],
        },
        defaultRowLimit,
        defaultTimeGrain.toLowerCase(),
        showLegend,
        showDataZoom,
        legendOrientation,
        legendType,
      );
      break;

      case "line":
        if (!chartMetrics) {
          throw new Error("Please select at least one metric for the bar chart");
        }
        
        chartData = await createLineChartRequest(
          dataset,
          filters,
          chartMetrics,
          {
            dimensions: formData.dimensions,
            x_axis: formData["x_axis"],
          },
          defaultRowLimit,
          defaultTimeGrain.toLowerCase(),
          showLegend,
          showDataZoom,
          legendOrientation,
          legendType
        );
        break;
    case "area":
      chartData = await createAreaChartRequest(
        dataset,
        filters,
        chartMetrics,
        {
          dimensions: formData.dimensions,
          x_axis: formData["x_axis"],
        },
        defaultRowLimit,
        defaultTimeGrain.toLowerCase(),
        showLegend,
        showDataZoom,
        legendOrientation,
        legendType
      );
      break;

    case "table":
      chartData = await createTableRequest(
        dataset,
        filters,
        chartMetrics,
        {
          dimensions: formData.dimensions,
        },
        defaultRowLimit,
        defaultTimeGrain.toLowerCase(),
        showLegend,
        legendOrientation,
        legendType
      );
      break;

    case "pivot_table":
      chartData = await createPivotTableRequest(
        dataset,
        filters,
        chartMetric,
        {
          dimensions: formData.dimensions,
        },
        defaultRowLimit,
        defaultTimeGrain.toLowerCase(),
        showLegend,
        legendOrientation,
        legendType
      );
      break;

    case "bignumber":
      chartData = await createBigNumberRequest(
        dataset,
        filters,
        chartMetric,
        {
          dimensions: formData.dimensions,
          x_axis: formData["x_axis"],
        },
        defaultRowLimit,
        defaultTimeGrain.toLowerCase()
      );
      break;

    // default:
    //   throw new Error("Unsupported chart type: " + activeChartType);
  }

  return {
    ...chartData,
    showLegend,
    legendOrientation,
    legendType,
    showDataZoom,
    showLabelLines,
  };
};