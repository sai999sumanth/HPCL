import React from 'react';
import ReactECharts from 'echarts-for-react';

interface ChartData {
  value: number;
  name: string;
}

interface AnalyticsPieChartProps {
  title: string;
  data: ChartData[];
}

const AnalyticsPieChart: React.FC<AnalyticsPieChartProps> = ({ title, data }) => {
  const option = {
    title: {
      text: title,
      left: 'center',
      top: '5%',
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333'
      }
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      top: '20%',
      textStyle: {
        fontSize: 12
      },
      formatter: (name: string) => {
        // Truncate long names
        return name.length > 20 ? name.substring(0, 18) + '...' : name;
      }
    },
    series: [
      {
        name: title,
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['65%', '60%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false,
        },
        emphasis: {
          label: {
            show: true,
            fontSize: '14',
            fontWeight: 'bold',
            formatter: '{b}\n{c}'
          }
        },
        labelLine: {
          show: false
        },
        data: data,
      }
    ]
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm">
      <ReactECharts option={option} style={{ height: '300px', width: '100%' }} />
    </div>
  );
};

export default AnalyticsPieChart;
