
import React from 'react';
import { Widget } from '../../../../types/DashbordTypes';
import Pie from '../Chart/ListOfCharts/Pie/Pie';
import Line from '../Chart/ListOfCharts/Line/Line';
import Bar from '../Chart/ListOfCharts/Bar/Bar';
import Table from '../Chart/ListOfCharts/Table/Table';
import BigNumber from '../Chart/ListOfCharts/BigNumber/BigNumber';
import Area from '../Chart/ListOfCharts/Area/Area';
import Donut from '../Chart/ListOfCharts/Donut/Donut';
import CustomBar from '../Chart/ListOfCharts/CustomBar/CustomBar';
import Gauge from '../Chart/ListOfCharts/Gauge/Gauge';
import TimeSeries from '../Chart/ListOfCharts/TImeSeries/TimeSeriesBar';
import StackedBar from '../Chart/ListOfCharts/StackedBarChart/StackedBarChart';
import CustomStackedBar from '../Chart/ListOfCharts/CustomStackedBarChart/CustomStackedBarChart';


interface ChartComponentProps {
  widget: Widget;
  resizeCounter: number;
  isMaximized?: boolean;
}

const ChartComponent: React.FC<ChartComponentProps> = ({ widget, resizeCounter,isMaximized   }) => {
  console.log('ChartComponent received widget:', widget);
  console.log('showResizeHandles:', isMaximized);

  if (!widget.chart_data) {
    return <div>No chart data available for {widget.name || 'Unknown chart'}</div>;
  }
  const { chart_type, chart_request } = widget.chart_data;
  const renderChart = () => {
    const commonProps = {
      data: {
        chartType: widget.chart_data.chart_type,
        chartData: widget.chart_data.chartData,
        chartRequest: widget.chart_data.chart_request,
        showLegend: widget.chart_data.showLegend,
        legendOrientation: widget.chart_data.legendOrientation,
        legendType: widget.chart_data.legendType,
        showLabelLines: widget.chart_data.showLabelLines,
        hideDataTable: !isMaximized,
        showDataZoom: true,
        showDataLabels:false,
        created_user: widget.chart_data.chart_request.created_by || '',
        maxValue: widget.chart_data.maxValue,
      },
      theme: "Westeros"
    };

    switch (widget.viz_type) {
      case 'pie':
        return <Pie {...commonProps} />;
        case 'donut':
        return <Donut {...commonProps} />;
      case 'line':
        return <Line {...commonProps} />;
      case 'bar':
        return <Bar {...commonProps} />;
        case 'custom_bar':
        return <CustomBar {...commonProps} />;
      case 'table':
        return <Table {...commonProps} />;
      case 'bignumber':
        return <BigNumber {...commonProps} />;
      case 'area':
        return <Area {...commonProps} />;
      case 'pivot_table':
        return <Table {...commonProps} />;
      case 'gauge':
        return <Gauge {...commonProps} />;
      case 'time_series_bar':
        return <TimeSeries {...commonProps} />;
      case 'stacked_bar':
        return <StackedBar {...commonProps} />;
      case 'custom_stacked_bar':
        return <CustomStackedBar {...commonProps} />; 
      default:
        return (
          <div className="flex items-center justify-center">
            Unknown Chart Type: {widget.viz_type}
          </div>
        );
    }
  };

  if (widget.chart_data) {
    return (
      <div className="w-full h-full " key={widget.i.toString() + '-' + resizeCounter.toString()}>
      {renderChart()}
  </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center">
      No data available for chart
    </div>
  );
};

export default ChartComponent;