
import React, { useEffect, useRef } from 'react';
import EChartsReact from 'echarts-for-react';
import { Westeros, Essos, Wonderland, Walden, Infographic, Macarons, Roma, CoolTheme, Shine } from '../../../_Chart/ChartTheme/ChartTheme';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../../../@/components/ui/tabs';
import AreaDataTable from './AreaDataTable';
import { LineSeriesOption } from 'echarts/charts';
import { EChartsOption } from 'echarts-for-react';

interface AreaChartProps {
  data: {
    chartType: string;
    chartData: Array<Record<string, any>>;
    showLegend: boolean;
    legendOrientation: 'top' | 'bottom' | 'left' | 'right';
    legendType: 'plain' | 'scroll';
    chartRequest: any;
    showDataZoom: boolean;
    hideDataTable?: boolean;
    showSymbol?: boolean;
    smooth?: boolean;
    stackedArea?: boolean;
    gradientArea?: boolean;
    showMarkLine?: boolean;
    showMarkPoint?: boolean;
  };
  theme: string;
}

const AreaChart: React.FC<AreaChartProps> = ({ data, theme }) => {
  const chartRef = useRef<EChartsReact>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
    
    if (typeof value === 'number') {
      if (Math.abs(value) > 1000000) {
        return new Intl.NumberFormat('en-US', {
          notation: 'compact'
        }).format(value);
      }
      
      if (Math.abs(value) < 1) {
        if (value < 0.5) return '0';
        if (value >= 0.5) return '1';
      }
      
      return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2
      }).format(value);
    }
    
    return String(value);
  };

  const processData = () => {
    const keys = Object.keys(data.chartData[0] || {});
    const categoryKey = keys[0];
    const valueKeys = keys.slice(1);
    const groupByFields = data.chartRequest.params.form_data.groupby?.map(g => g.name) || [];
    const hasGroupBy = groupByFields.length > 0;
    const dimensions = groupByFields.length;

    const uniqueCategories = Array.from(new Set(
      data.chartData.map(item => String(item[categoryKey]))
    ));

    if (hasGroupBy) {
      const getDimensionKey = (item: any) => 
        groupByFields.map(field => item[field]).join('|');

      const uniqueDimensions = Array.from(new Set(
        data.chartData.map(getDimensionKey)
      )).map(key => ({
        key,
        values: key.split('|')
      }));

      const series = uniqueDimensions.flatMap(dimension =>
        valueKeys.map(metricKey => {
          const seriesName = dimension.values.join(' - ');
          const seriesData = uniqueCategories.map(category => {
            const matchingItem = data.chartData.find(item => 
              String(item[categoryKey]) === category && 
              getDimensionKey(item) === dimension.key
            );

            return {
              value: matchingItem?.[metricKey] ?? 0,
              itemData: matchingItem,
              dimensions: groupByFields.map((field, index) => ({
                field,
                value: dimension.values[index]
              })),
              metric: metricKey,
              dimensionDisplay: seriesName
            };
          });

          return {
            // name: `${seriesName} - ${metricKey}`,
            name: `${metricKey},${dimension.values.join(' - ')} :`,

            type: 'line' as const,
            data: seriesData,
            smooth: data.smooth ?? false,
            showSymbol: data.showSymbol ?? false,
            symbolSize: 4,
            stack: data.stackedArea ? 'total' : undefined,
            areaStyle: {
              opacity: data.gradientArea ? 0.3 : 0.7,
              ...(data.gradientArea && {
                color: {
                  type: 'linear',
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [{
                    offset: 0,
                    color: 'rgba(var(--color), 0.5)'
                  }, {
                    offset: 1,
                    color: 'rgba(var(--color), 0.05)'
                  }]
                }
              })
            },
            emphasis: {
              focus: 'series',
              areaStyle: {
                opacity: data.gradientArea ? 0.5 : 0.9
              }
            },
            ...(data.showMarkPoint && {
              markPoint: {
                data: [
                  { type: 'max', name: 'Maximum' },
                  { type: 'min', name: 'Minimum' }
                ]
              }
            }),
            ...(data.showMarkLine && {
              markLine: {
                data: [{ type: 'average', name: 'Average' }]
              }
            })
          };
        })
      );

      return { categories: uniqueCategories, series, hasGroupBy, dimensions };
    } else {
      const series: LineSeriesOption[] = valueKeys.map(key => ({
        name: key,
        type: 'line',
        data: uniqueCategories.map(category => {
          const matchingItem = data.chartData.find(item => 
            String(item[categoryKey]) === category
          );
          return {
            value: matchingItem ? Number(matchingItem[key]) : 0,
            itemData: matchingItem,
            metric: key
          };
        }),
        smooth: data.smooth ?? false,
        showSymbol: data.showSymbol ?? false,
        symbolSize: 4,
        stack: data.stackedArea ? 'total' : undefined,
        areaStyle: {
          opacity: data.gradientArea ? 0.3 : 0.7,
          ...(data.gradientArea && {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [{
                offset: 0,
                color: 'rgba(var(--color), 0.5)'
              }, {
                offset: 1,
                color: 'rgba(var(--color), 0.05)'
              }]
            }
          })
        },
        emphasis: {
          focus: 'series',
          areaStyle: {
            opacity: data.gradientArea ? 0.5 : 0.9
          }
        },
        ...(data.showMarkPoint && {
          markPoint: {
            data: [
              { type: 'max', name: 'Maximum' },
              { type: 'min', name: 'Minimum' }
            ]
          }
        }),
        ...(data.showMarkLine && {
          markLine: {
            data: [{ type: 'average', name: 'Average' }]
          }
        })
      }));

      return { categories: uniqueCategories, series, hasGroupBy, dimensions: 0 };
    }
  };

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
 const getGroupByColumns = () => {
    // Get only the groupby columns from form_data
    return data.chartRequest.params.form_data.groupby?.map(g => g.name.toLowerCase()) || [];
  };
  const { categories, series, hasGroupBy, dimensions } = processData();
  const selectedTheme = getSelectedTheme(theme);
  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
        snap: true,
        animation: true,
        shadowStyle: {
          color: 'rgba(150,150,150,0.1)'
        }
      },
      enterable: true,
      position: function (point, params, dom, rect, size) {
        const gap = 20;
        const chartWidth = containerRef.current?.clientWidth || 0;
        const chartHeight = containerRef.current?.clientHeight || 0;
        const tooltipWidth = size.contentSize[0];
        const tooltipHeight = size.contentSize[1];
        
        let [x, y] = point;
        
        if (x + tooltipWidth + gap > chartWidth) {
          x = x - tooltipWidth - gap;
        } else {
          x = x + gap;
        }
        
        if (y + tooltipHeight + gap > chartHeight) {
          y = y - tooltipHeight - gap;
        } else {
          y = y + gap;
        }
        
        x = Math.max(gap, Math.min(x, chartWidth - tooltipWidth - gap));
        y = Math.max(gap, Math.min(y, chartHeight - tooltipHeight - gap));
        
        return [x, y];
      },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#ccc',
      borderWidth: 1,
      padding: [8, 12],
      textStyle: {
        color: '#333',
        fontSize: 12
      },
      extraCssText: 'box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); border-radius: 4px;',
      formatter: function(params: any) {
        if (!Array.isArray(params)) return '';
        
        const groupByColumns = getGroupByColumns();
        
        // Filter out params where series name contains any groupby column
        const filteredParams = params.filter((param: any) => {
          const seriesName = param.seriesName.toLowerCase();
          return !groupByColumns.some(column => seriesName.startsWith(column));
        });

        // Filter out zero values
        const nonZeroParams = filteredParams.filter((param: any) => 
          param.data
        );
  
        let tooltipContent = `
          <div style="margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #eee;">
            <span style="font-size: 13px; font-weight: 600; color: #666;">
              ${params[0].name}
            </span>
          </div>
        `;
  
        // Group by metric type
        const metricGroups = new Map();
        
        nonZeroParams.forEach((param: any) => {
          const data = param.data;
          if (!data || !data.metric) return;
          
          if (!metricGroups.has(data.metric)) {
            metricGroups.set(data.metric, []);
          }
          
          metricGroups.get(data.metric).push({
            name: param.seriesName,
            value: data.value,
            color: param.color,
            itemData: data.itemData
          });
        });
  
        // Add each metric group to tooltip
        metricGroups.forEach((items, metric) => {
          tooltipContent += `
            <div style="margin-top: 8px;">
              ${items.map((item: any) => `
                <div style="display: flex; justify-content: space-between; align-items: center; margin: 4px 0;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="color: ${item.color}; font-size: 16px;">●</span>
                    <span style="color: #666; font-size: 12px;">
                      ${item.name} ${formatValue(item.value)}
                    </span>
                  </div>
                  <span style="font-size: 12px; color: #666;">
                  </span>
                </div>
              `).join('')}
            </div>
          `;
        });
  
        return `
          <div style="max-height: 200px; overflow-y: auto;">
            ${tooltipContent}
          </div>
        `;
      }
    },
    legend: {
      show: data.showLegend,
      type: data.legendType,
      ...(hasGroupBy ? {
        orient: data.legendOrientation === 'left' || data.legendOrientation === 'right' 
          ? 'vertical' 
          : 'horizontal',
        top: data.legendOrientation === 'top' ? '0' : 'auto',
        bottom: data.legendOrientation === 'bottom' ? '0' : 'auto',
        left: data.legendOrientation === 'left' ? '0' : 'auto',
        right: data.legendOrientation === 'right' ? '0' : 'auto',
        textStyle: {
          fontSize: 12
        }
      } : {
        top: data.legendOrientation === 'top' ? '0' : 'auto',
        bottom: data.legendOrientation === 'bottom' ? '0' : 'auto',
        left: data.legendOrientation === 'left' ? '0' : 'auto',
        right: data.legendOrientation === 'right' ? '0' : 'auto',
      })
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: data.showDataZoom ? '15%' : '3%',
      top: data.legendOrientation === 'top' ? '15%' : '8%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: categories,
      axisLine: {
        show: true,
        lineStyle: {
          color: '#333',
          width: 1
        }
      },
      axisTick: {
        show: true,
        alignWithLabel: true
      },
      axisLabel: {
        rotate: categories.length > 12 ? 45 : 0,
        show: true,
        hideOverlap: true,
        interval: 'auto'
      },
      splitLine: {
        show: false
      }
    },
    yAxis: {
      type: 'value',
      axisLine: {
        show: true,
        lineStyle: {
          color: '#333',
          width: 1
        }
      },
      axisTick: {
        show: true
      },
      axisLabel: {
        show: true,
        formatter: formatValue
      },
      splitLine: {
        show: true,
        lineStyle: {
          type: 'dashed',
          color: '#ddd'
        }
      }
    },
    series: series,
    dataZoom: data.showDataZoom ? [
      {
        type: 'slider',
        show: true,
        start: 0,
        end: 100,
        bottom: 10,
        zoomLock: false
      },
      {
        type: 'inside',
        start: 0,
        end: 100,
        zoomOnMouseWheel: false,
        zoomLock: true
      }
    ] : []
  };

  useEffect(() => {
    if (chartRef.current) {
      const chart = chartRef.current.getEchartsInstance();
      chart.resize();
    }
  }, [data]);
  return (
    <div ref={containerRef} className="w-full h-full flex flex-col">
      {data.hideDataTable ? (
        <div className="flex-grow">
          <EChartsReact
            ref={chartRef}
            option={option}
            theme={selectedTheme}
            style={{ height: '100%', width: '100%' }}
            notMerge={true}
            opts={{ renderer: 'canvas' }}
          />
        </div>
      ) : (
        <div className="flex-grow">
          <EChartsReact
            ref={chartRef}
            option={option}
            theme={selectedTheme}
            style={{ height: '400px', width: '100%' }}
            notMerge={true}
            opts={{ renderer: 'canvas' }}
          />
        </div>
      )}

      {!data.hideDataTable && (
        <div className="flex-shrink-0 overflow-auto">
          <Tabs defaultValue="results">
            <TabsList className="mb-2">
              <TabsTrigger value="results">RESULTS</TabsTrigger>
            </TabsList>
            <TabsContent value="results" className="h-full overflow-auto">
              <AreaDataTable data={data.chartData} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
};

export default AreaChart;