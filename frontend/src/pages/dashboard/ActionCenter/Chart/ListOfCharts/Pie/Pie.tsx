import React, { useRef, useEffect, useState } from 'react';
import EChartsReact from 'echarts-for-react';
import { Westeros, Essos, Wonderland, Walden, Infographic, Macarons, Roma, CoolTheme, Shine } from '../../../_Chart/ChartTheme/ChartTheme';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../../../@/components/ui/tabs';
import PieDataTable from './PieTableData';

interface PieProps {
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
  onChartClick?: (params: any) => void; // Add optional click handler prop
  
}

const Pie: React.FC<PieProps> = ({ data, theme, onChartClick }) => {
  const chartRef = useRef<EChartsReact>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  console.log(data.chartData, "chartData from piechart")

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

  // Add click event handler setup
  useEffect(() => {
    if (chartRef.current) {
      const chart = chartRef.current.getEchartsInstance();
      
      // Setup click event handler
      chart.on('click', (params) => {
        console.log('Clicked segment:', params);
        setSelectedSegment(params.name);
        
        // Call the optional external click handler if provided
        if (onChartClick) {
          onChartClick(params);
        }
      });

      // Cleanup function to remove event listener
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
      confine: true, // Keeps tooltip within the chart container
      position: function (point, params, dom, rect, size) {
        // Adjust tooltip position based on available space
        const [x, y] = point;
        const { viewSize } = size;
        const [viewWidth, viewHeight] = viewSize;
  
        // Define tooltipX and tooltipY defaults based on the point
        let tooltipX = x;
        let tooltipY = y;
  
        // Check if dom is an HTMLDivElement to safely access offsetWidth and offsetHeight
        if (dom instanceof HTMLDivElement) {
          const tooltipWidth = dom.offsetWidth;
          const tooltipHeight = dom.offsetHeight;
  
          // Ensure tooltip stays within boundaries
          if (x + tooltipWidth > viewWidth) {
            tooltipX = viewWidth - tooltipWidth - 10;
          }
          if (y + tooltipHeight > viewHeight) {
            tooltipY = viewHeight - tooltipHeight - 10;
          }
        }
        
        return [tooltipX, tooltipY];
      },
      formatter: (params) => {
        const { name, value, percent } = params;
        console.log("name",name);

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
        radius: '50%',
        center: ['50%', '60%'], // Slightly lower to adjust the position
        data: processedData,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          }
        },
        label: {
          show: data.showLabelLines,
          formatter: '{b}: {c} ({d}%)',
          position: 'outer',
          alignTo: 'none',
          bleedMargin: 5,
        },
        labelLine: {
          show: data.showLabelLines,
          length: 15,
          length2: 10,
          smooth: true,
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
              <PieDataTable data={data.chartData} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
};

export default Pie;