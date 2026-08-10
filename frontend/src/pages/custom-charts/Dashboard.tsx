import React, { useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';

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
      title: { offsetCenter: ['0%', '-30%'] },
      detail: {
        valueAnimation: true,
        offsetCenter: ['0%', '-20%']
      },
      itemStyle: { color: '#5B8FF9' }
    },
    {
      value: 40,
      title: { offsetCenter: ['0%', '0%'] },
      detail: {
        valueAnimation: true,
        offsetCenter: ['0%', '10%']
      },
      itemStyle: { color: '#95DE64' }
    },
    {
      value: 60,
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

  useEffect(() => { 
    const timer = setInterval(() => {
      if (chartRef.current) {
        const newData = getInitialGaugeData().map(item => ({
          ...item,
          value: +(Math.random() * 100).toFixed(2)
        }));
        
        chartRef.current.getEchartsInstance().setOption({
          series: [{ data: newData }]
        });
      }
    }, 2000);

    return () => clearInterval(timer);
  }, []);

  return (
    <ReactECharts 
      ref={chartRef}
      option={option}
      style={{ height: '400px', width: '100%' }}
    />
  );
};

const Dashboard = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
        <MultiRingGaugeWidget />
        <StackedBarWidget />
    </div>
  );
};

export default Dashboard;