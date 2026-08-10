
import React, { useRef, useEffect, useState } from 'react';
import EChartsReact from 'echarts-for-react';
import { Westeros, Essos, Wonderland, Walden, Infographic, Macarons, Roma, CoolTheme, Shine } from '../../../_Chart/ChartTheme/ChartTheme';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../../../@/components/ui/tabs';
import DonutDataTable from './DonutDataTable';

interface DonutProps {
  data: {
    chartType: string;
    chartData: Array<Record<string, any>>;
    showLegend: boolean;
    legendOrientation: 'top' | 'bottom' | 'left' | 'right';
    legendType: 'plain' | 'scroll';
    chartRequest: any;
    showLabelLines: boolean;
    hideDataTable?: boolean;
  };
  theme: string;
  onChartClick?: (params: any) => void;
}

const Donut: React.FC<DonutProps> = ({ data, theme, onChartClick }) => {
  const chartRef = useRef<EChartsReact>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);

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

  useEffect(() => {
    if (chartRef.current) {
      const chart = chartRef.current.getEchartsInstance();
      
      chart.on('click', (params) => {
        console.log('Clicked segment:', params);
        setSelectedSegment(params.name);
        
        if (onChartClick) {
          onChartClick(params);
        }
      });

      return () => {
        chart.off('click');
      };
    }
  }, [onChartClick]);

  const processedData = data.chartData.map(item => {
    const keys = Object.keys(item);
    return {
      name: keys.slice(0, -1).map(key => String(item[key])).join(', '),
      value: Number(item[keys[keys.length - 1]])
    };
  }).filter(item => !isNaN(item.value));

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

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const { name, value, percent } = params;
        return `${name}: ${value.toFixed(2)} (${percent.toFixed(2)}%)`;
      }
    },
    legend: {
      show: data.showLegend,
      orient: data.legendOrientation === 'left' || data.legendOrientation === 'right' ? 'vertical' : 'horizontal',
      [data.legendOrientation]: 10,
      type: data.legendType,
    },
    color: selectedTheme.color,
    series: [
      {
        name: 'Data',
        type: 'pie',
        radius: ['40%', '70%'], // Inner and outer radius to create donut effect
        center: ['50%', '50%'],
        data: processedData,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        },
        label: {
          show: data.showLabelLines,
          formatter: '{b}: {c} ({d}%)',
          position: 'outer',
          alignTo: 'none',
          bleedMargin: 5
        },
        labelLine: {
          show: data.showLabelLines,
          length: 15,
          length2: 10,
          smooth: true
        }
      }
    ]
  };

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col">
      {data.hideDataTable ? (
        <div className="flex-grow">
          <EChartsReact
            ref={chartRef}
            option={option}
            theme={selectedTheme}
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'svg' }}
          />
          {selectedSegment && (
            <div className="mt-2 p-2 text-sm text-gray-600">
              Selected segment: {selectedSegment}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-grow">
          <EChartsReact
            ref={chartRef}
            option={option}
            theme={selectedTheme}
            style={{ height: '400px', width: '100%' }}
            opts={{ renderer: 'svg' }}
          />
          {selectedSegment && (
            <div className="mt-2 p-2 text-sm text-gray-600">
              Selected segment: {selectedSegment}
            </div>
          )}
        </div>
      )}

      {!data.hideDataTable && (
        <div className="flex-shrink-0 overflow-auto">
          <Tabs defaultValue="results">
            <TabsList className="mb-2">
              <TabsTrigger value="results">RESULTS</TabsTrigger>
            </TabsList>
            <TabsContent value="results" className="h-full overflow-auto">
              <DonutDataTable data={data.chartData} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
};

export default Donut;