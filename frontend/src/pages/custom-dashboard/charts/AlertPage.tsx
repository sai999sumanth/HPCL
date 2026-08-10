import React, { useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import Dashboard from './Dashboard';
import { Card } from '@/@/components/ui/card';


const RingGaugeWidget = ({ value, total = 100, color = '#5B8FF9' }) => {
  const option = {
    series: [{
      type: 'gauge',
      startAngle: 90,
      endAngle: -270,
      pointer: { show: false },
      progress: {
        show: true,
        overlap: false,
        roundCap: true,
        clip: false,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [{
              offset: 0,
              color: color
            }, {
              offset: 1,
              color: color.replace(')', ', 0.7)')
            }]
          }
        }
      },
      axisLine: {
        lineStyle: {
          width: 18,
          color: [[1, '#E6EBF8']]
        }
      },
      splitLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      anchor: { show: false },
      title: { show: false },
      detail: {
        valueAnimation: true,
        offsetCenter: [0, 0],
        fontSize: 24,
        fontWeight: 'bold',
        formatter: `${value} / ${total}`,
        color: '#333'
      },
      data: [{
        value: value
      }]
    }]
  };

  return (
    <ReactECharts 
      option={option}
      style={{ height: '200px' }}
    />
  );
};

const StackedBarWidget = () => {
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: [{
      type: 'category',
      data: ['Gondor', 'Rohan', 'Hobbiton'],
      axisTick: { show: false }
    }],
    yAxis: [{
      type: 'value',
      axisTick: { show: false }
    }],
    series: [{
      name: 'Main',
      type: 'bar',
      stack: 'total',
      itemStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [{
            offset: 0,
            color: '#91CC75'
          }, {
            offset: 1,
            color: '#91CC75AA'
          }]
        }
      },
      data: [320, 302, 301]
    }, {
      name: 'Secondary',
      type: 'bar',
      stack: 'total',
      itemStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [{
            offset: 0,
            color: '#5470C6'
          }, {
            offset: 1,
            color: '#5470C6AA'
          }]
        }
      },
      data: [120, 132, 101]
    }]
  };

  return (
    <ReactECharts 
      option={option}
      style={{ height: '300px' }}
    />
  );
};

const SankeyWidget = () => {
  const option = {
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove'
    },
    series: [{
      type: 'sankey',
      data: [{
        name: 'main'
      }, {
        name: 'Gondor'
      }, {
        name: 'Rohan'
      }, {
        name: 'Hobbiton'
      }],
      links: [{
        source: 'main',
        target: 'Gondor',
        value: 5
      }, {
        source: 'main',
        target: 'Rohan',
        value: 3
      }, {
        source: 'main',
        target: 'Hobbiton',
        value: 2
      }],
      lineStyle: {
        color: 'gradient',
        curveness: 0.5
      }
    }]
  };

  return (
    <ReactECharts 
      option={option}
      style={{ height: '300px' }}
    />
  );
};

const servicesData = [
  { name: 'Cloud Memorystore', value: 3000, prevValue: 2800 },
  { name: 'Networking', value: 2000, prevValue: 1800 },
  { name: 'AlloyDB', value: 1000, prevValue: 900 },
  { name: 'Stackdriver Monitoring', value: 935, prevValue: 850 },
  { name: 'Translate', value: 881, prevValue: 800 },
  { name: 'NetApp Cloud', value: 732, prevValue: 700 },
  { name: 'Cloud Key Management', value: 596, prevValue: 550 },
  { name: 'Cloud DNS', value: 547, prevValue: 500 },
  { name: 'Cloud Storage', value: 454, prevValue: 400 },
  { name: 'Vertex AI', value: 381, prevValue: 350 }
];

const StackedBarWidgetv2 = () => {
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: true, lineStyle: { type: 'dashed' } }
    },
    yAxis: {
      type: 'category',
      data: servicesData.map(item => item.name),
      axisLine: { show: false },
      axisTick: { show: false }
    },
    series: [
      {
        name: 'Current Month',
        type: 'bar',
        data: servicesData.map(item => item.value),
        itemStyle: {
          color: '#5B8FF9'
        },
        barWidth: '20',
        stack: 'total'
      },
      {
        name: 'Previous Month',
        type: 'bar',
        data: servicesData.map(item => item.prevValue),
        itemStyle: {
          color: '#FF9F7F'
        },
        barWidth: '20',
        stack: 'total'
      }
    ]
  };

  return (
    <ReactECharts 
      option={option}
      style={{ height: '400px' }}
    />
  );
};

const MultiRingGaugeWidget = () => {
  const chartRef = useRef(null);

  const getInitialGaugeData = () => [
    {
      value: 20,
      name: 'Perfect',
      title: { offsetCenter: ['0%', '-30%'] },
      detail: {
        valueAnimation: true,
        offsetCenter: ['0%', '-20%']
      },
      itemStyle: { color: '#5B8FF9' }
    },
    {
      value: 40,
      name: 'Good',
      title: { offsetCenter: ['0%', '0%'] },
      detail: {
        valueAnimation: true,
        offsetCenter: ['0%', '10%']
      },
      itemStyle: { color: '#95DE64' }
    },
    {
      value: 60,
      name: 'Commonly',
      title: { offsetCenter: ['0%', '30%'] },
      detail: {
        valueAnimation: true,
        offsetCenter: ['0%', '40%']
      },
      itemStyle: { color: '#FF9F7F' }
    }
  ];

  const option = {
    series: [
      {
        type: 'gauge',
        startAngle: 90,
        endAngle: -270,
        pointer: { show: false },
        progress: {
          show: true,
          overlap: false,
          roundCap: true,
          clip: false,
          itemStyle: {
            borderWidth: 1,
            borderColor: '#464646'
          }
        },
        axisLine: {
          lineStyle: { width: 40 }
        },
        splitLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        data: getInitialGaugeData(),
        title: { fontSize: 14 },
        detail: {
          width: 50,
          height: 14,
          fontSize: 14,
          color: 'inherit',
          borderColor: 'inherit',
          borderRadius: 20,
          borderWidth: 1,
          formatter: '{value}%'
        }
      }
    ]
  };
}

export const AlertPage = () => {
  return (
    <>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      <Card className="p-4">
        <RingGaugeWidget value={65} color="rgb(91, 143, 249)" />
      </Card>
      <Card className="p-4">
        <RingGaugeWidget value={45} color="rgb(255, 99, 71)" />
      </Card>
      <Card className="p-4">
        <RingGaugeWidget value={59} color="rgb(255, 196, 0)" />
      </Card>
      <Card className="md:col-span-2">
        <StackedBarWidget />
      </Card>
      <Card>
        <SankeyWidget />
      </Card>
    </div>
    <Card>
    <Dashboard/>
    </Card>
    </>
  );
};
