import React, { useEffect, useState, useRef } from 'react';
import EChartsReact from 'echarts-for-react';
import { Westeros, Essos, Wonderland, Walden, Infographic, Macarons, Roma, CoolTheme, Shine } from '../../../_Chart/ChartTheme/ChartTheme';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../../../@/components/ui/tabs';
import { EChartsOption, SeriesOption } from 'echarts';
import LineDataTable from '../Line/LineDataTable';

interface ChartRequest {
  params: {
    form_data: {
      x_axis: {
        name: string;
        type?: string;
        label:string;
      };
      groupby: Array<{
        name: string;
        label:string;
      }>;
    };
    queries: Array<{
      metrics: Array<{
        column: {
          column_name: string;
        };
        label: string;  // This will store the alias name
      }>;
    }>;
  };
}

interface LineProps {
  data: {
    chartType: string;
    chartData: Array<Record<string, any>>;
    showLegend: boolean;
    legendOrientation: 'top' | 'bottom' | 'left' | 'right';
    legendType: 'plain' | 'scroll';
    chartRequest: ChartRequest;
    showDataZoom: boolean;
    hideDataTable?: boolean;
  };
  theme: string;
}

const TimeSeriesLine: React.FC<LineProps> = ({ data, theme }) => {
  const chartRef = useRef<EChartsReact>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width, height });
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.getEchartsInstance().resize();
    }
  }, [containerSize]);

  const processData = () => {
    if (!data.chartData || data.chartData.length === 0) return { dimensions: [], categories: [], series: [] };

    const chartRequest = data.chartRequest;
    
    const xAxisColumn = chartRequest.params.form_data.x_axis.label||chartRequest.params.form_data.x_axis.name;
    const xAxisType = chartRequest.params.form_data.x_axis.type;
  console.log(chartRequest.params.form_data.x_axis.type,"chartRequest.params.form_data.x_axis.type")
    if (xAxisType !== 'timestamp with time zone' && xAxisType !== 'timestamp without time zone') {
      return {
        error: `Error: The x-axis column '${xAxisColumn}' is not a valid timestamp type. Please select a column with a timestamp data type.`
      };
    }
    
    const dimensionColumns = chartRequest.params.form_data.groupby.map(group => group.label||group.name);
    
    // Get metrics with their corresponding aliases
    const metrics = chartRequest.params.queries[0].metrics.map(metric => ({
      columnName: metric.column.column_name,
      alias: metric.label || metric.column.column_name // Use label as alias if provided, otherwise use column name
    }));

    const dimensions = dimensionColumns.length > 0
      ? Array.from(new Set(data.chartData.map(item => item[dimensionColumns[0]])))
      : [''];

    const categories = Array.from(new Set(data.chartData.map(item => item[xAxisColumn])))
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    // Updated series creation to handle aliases
    const series: SeriesOption[] = dimensions.flatMap(dimension => 
      metrics.map(({ columnName, alias }) => {
        const dimensionData = data.chartData
          .filter(item => dimensionColumns.length === 0 || item[dimensionColumns[0]] === dimension)
          .sort((a, b) => new Date(a[xAxisColumn]).getTime() - new Date(b[xAxisColumn]).getTime())
          .map(item => {
            // Check for both column name and alias in the data
            let value = null;
            if (item[columnName] !== undefined) {
              value = Number(item[columnName]);
            } else if (item[alias] !== undefined) {
              value = Number(item[alias]);
            } else {
              // Look for any key that includes the column name or alias
              const matchingKey = Object.keys(item).find(key => 
                key.includes(columnName) || key.includes(alias)
              );
              if (matchingKey) {
                value = Number(item[matchingKey]);
              }
            }

            return {
              name: new Date(item[xAxisColumn]).toLocaleDateString(),
              value: value,
              itemData: item
            };
          });

        const seriesName = dimensionColumns.length > 0 
          ? `${dimension} - ${alias}` 
          : alias;

        return {
          name: seriesName,
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: {
            width: 3
          },
          data: dimensionData,
          emphasis: {
            focus: 'series',
            blurScope: 'coordinateSystem',
            lineStyle: {
              width: 4
            },
            symbolSize: 10
          }
        };
      })
    );

    return { dimensions, categories, series };
  };

  // Update tooltip formatter to use aliases
  const getTooltipFormatter = () => {
    return function(params: any[]) {
      if (!params || params.length === 0) return '';

      const firstParam = params[0];
      const itemData = firstParam.data.itemData;
      const xAxisColumn = data.chartRequest.params.form_data.x_axis.name;
      const date = new Date(itemData[xAxisColumn]);
      const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();

      let tooltip = `<div style="font-weight: bold; margin-bottom: 4px;">${formattedDate}</div>`;

      // Create a map of column names to their aliases
      const metricAliasMap = new Map(
        data.chartRequest.params.queries[0].metrics.map(metric => [
          metric.column.column_name,
          metric.label || metric.column.column_name
        ])
      );

      Object.entries(itemData).forEach(([key, value]) => {
        // Use alias if available, otherwise use the original key
        const displayKey = metricAliasMap.get(key) || key;
        const displayValue = key.toLowerCase().includes('time') || key.toLowerCase().includes('date')
          ? new Date(value as string).toLocaleString()
          : value;

        tooltip += `
          <div style="display: flex; justify-content: space-between; margin: 2px 0;">
            <span style="color: #666;">${displayKey}:</span>
            <span style="margin-left: 12px; font-weight: ${
              metricAliasMap.has(key) ? 'bold' : 'normal'
            }">${displayValue}</span>
          </div>`;
      });

      return tooltip;
    };
  };

  const { dimensions, categories, series, error } = processData();

  if (error) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="bg-red-500 text-white px-4 py-2 rounded-md">{error}</div>
      </div>
    );
  }

  const getSelectedTheme = (themeName: string) => {
    switch (themeName) {
      case 'Essos': return Essos;
      case 'Wonderland': return Wonderland;
      case 'Walden': return Walden;
      case 'Infographic': return Infographic;
      case 'Macarons': return Macarons;
      case 'Roma': return Roma;
      case 'CoolTheme': return CoolTheme;
      case 'Shine': return Shine;
      default: return Westeros;
    }
  };

  const selectedTheme = getSelectedTheme(theme);

  const option: EChartsOption = {
    animation: false,
    tooltip: {
      trigger: 'axis',
      formatter: function(params: any[]) {
        if (!params || params.length === 0) return '';

        const firstParam = params[0];
        const itemData = firstParam.data.itemData;
        console.log("itemData",itemData);
        // Format date for display
        const xAxisColumn = data.chartRequest.params.form_data.x_axis.label||data.chartRequest.params.form_data.x_axis.name;
        const date = new Date(itemData[xAxisColumn]);
        const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();

        // Create tooltip content
        let tooltip = `<div style="font-weight: bold; margin-bottom: 4px;">${formattedDate}</div>`;

        // Add all data columns
        Object.entries(itemData).forEach(([key, value]) => {
          // Format date values
          const displayValue = key.toLowerCase().includes('time') || key.toLowerCase().includes('date')
            ? new Date(value as string).toLocaleString()
            : value;

          tooltip += `
            <div style="display: flex; justify-content: space-between; margin: 2px 0;">
              <span style="color: #666;">${key}:</span>
              <span style="margin-left: 12px; font-weight: ${
                data.chartRequest.params.queries[0].metrics.some(m => m.column.column_name === key) 
                ? 'bold' : 'normal'
              }">${displayValue}</span>
            </div>`;
        });

        return tooltip;
      }
    },
    legend: {
      show: data.showLegend,
      type: data.legendType,
      orient: data.legendOrientation === 'left' || data.legendOrientation === 'right' ? 'vertical' : 'horizontal',
      top: data.legendOrientation === 'top' ? '0' : 'auto',
      bottom: data.legendOrientation === 'bottom' ? '0' : 'auto',
      left: data.legendOrientation === 'left' ? '0' : 'auto',
      right: data.legendOrientation === 'right' ? '0' : 'auto',
      textStyle: {
        fontSize: 12
      },
      itemWidth: 15,
      itemHeight: 10,
      pageButtonPosition: 'end',
      selector: false,
      selectedMode: true,
      emphasis: {
        selectorLabel: {
          show: true
        }
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: data.legendOrientation === 'top' ? '15%' : '8%',
      containLabel: true
    },
    xAxis: {
      type: 'time',
      boundaryGap: ['5%', '5%'],
      // data: categories.map(date => new Date(date).toLocaleDateString()),
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => value.toFixed(2)
      },
      splitLine: {
        show: true,
        lineStyle: {
          type: 'dashed'
        }
      }
    },
    series: series,
    dataZoom: [
      {
        type: 'slider',
        show: data.showDataZoom,
        start: 0,
        end: 100,
        height: 30,
        bottom: 5,
        brushSelect: true,
        zoomLock: false,
        moveOnMouseMove: true
      },
      {
        type: 'inside',
        start: 0,
        end: 100,
        zoomOnMouseWheel: false,
        moveOnMouseMove: true
      }
    ],
    color: selectedTheme.color,
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      <div className="relative" style={{ height: '400px', width: '100%' }}>
        <div className="absolute top-2 right-2 flex items-center space-x-2 z-10">
          {/* <div className="bg-white-500 text-black px-3 py-1 rounded-full text-sm font-sm">
            {data.chartData.length} rows
          </div> */}
        </div>
        <EChartsReact
          ref={chartRef}
          option={option}
          style={{ height: '100%', width: '100%' }}
          theme={selectedTheme}
          notMerge={true}
          lazyUpdate={false}
          opts={{ renderer: 'canvas' }}
        />
      </div>

      {!data.hideDataTable && (
        <div className="mt-4">
          <Tabs defaultValue="results">
            <TabsList>
              <TabsTrigger value="results">RESULTS</TabsTrigger>
            </TabsList>
            <TabsContent value="results" className="h-64 overflow-auto">
              <LineDataTable data={data.chartData} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
};

export default TimeSeriesLine;