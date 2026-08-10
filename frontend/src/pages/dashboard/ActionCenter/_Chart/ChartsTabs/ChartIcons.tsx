
import BarChart from "../../../../../assets/viz_thumbnails/bar.png";
import PieChart from "../../../../../assets/viz_thumbnails/pie.png";
import LineChart from "../../../../../assets/viz_thumbnails/line.png";
import AreaChart from "../../../../../assets/viz_thumbnails/area.png";
import SunburstChart from "../../../../../assets/viz_thumbnails/sunburst.png";
import BigNumber from "../../../../../assets/viz_thumbnails/big_number.png";
import CustomTable from "../../../../../assets/viz_thumbnails/table.png";
import PivotTable from "../../../../../assets/viz_thumbnails/pivot_table.png";
import GaugeChart from "../../../../../assets/viz_thumbnails/gauge.png";
import DonutChart from "../../../../../assets/viz_thumbnails/donut.png";
import CustomBarChart from "../../../../../assets/viz_thumbnails/custom_bar.png";
import StackedBarChart from "../../../../../assets/viz_thumbnails/stacked_bar.png";
import CustomStackedBarChart from "../../../../../assets/viz_thumbnails/custom_stacked_bar.png";
import TimeSeriesLineChart from "../../../../../assets/viz_thumbnails/time_series_line.png";
import TimeSeriesBarChart from "../../../../../assets/viz_thumbnails/time_series_bar.png";

import { createGaugeChart } from "../ChartRequests/GaugeChartRequest";
export const getChartIcon = (chartName: string): string => {
  switch (chartName.toLowerCase()) {
    case "bar":
      return BarChart;
    case "stacked_bar":
      return StackedBarChart;
    case "custom_bar":
      return CustomBarChart;
    case "custom_stacked_bar":
      return CustomStackedBarChart;
    case "timeseries bar chart":
      return TimeSeriesBarChart;
    case "timeseries line chart":
      return TimeSeriesLineChart;
      case "line":
        return LineChart;
      case "area":
        return AreaChart;
      case "pie":
        return PieChart;
        case "gauge":
          return GaugeChart;
      case "table":
        return CustomTable;
      case "bignumber":
        return BigNumber;
      case "donut":
        return DonutChart;
      case "sunburst":
        return SunburstChart;
      case "pivot_table":
        return PivotTable;
      default:
        return CustomTable; // Default to table icon
    }
  };