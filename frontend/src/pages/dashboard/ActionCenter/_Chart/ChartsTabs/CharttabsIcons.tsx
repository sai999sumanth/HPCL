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

export const getChartIcon = (chartName: string): string => {
    switch (chartName.toLowerCase()) {
      case "bar chart":
        return BarChart;
        case "stacked bar chart":
          return StackedBarChart;
          case "custom stacked bar chart":
            return CustomStackedBarChart;
      case "custom bar chart":
        return CustomBarChart;
      case "line chart":
        return LineChart;
      case "area chart":
        return AreaChart;
      case "pie chart":
        return PieChart;
        case "gauge chart":
          return GaugeChart;
      case "table":
        return CustomTable;
      case "big number":
        return BigNumber;
      case "donut chart":
        return DonutChart;
      case "sunburst chart":
        return SunburstChart;
      case "pivot table":
        return PivotTable;
        case "timeseries bar chart":
        return TimeSeriesBarChart;
        case "timeseries line chart":
        return TimeSeriesLineChart;
      default:
        return CustomTable; // Default to table icon
    }
  };