import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { fetchHistoricalYearsData } from './services/performanceApi';
import { DrilldownYearlyData } from './types';

interface DrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
  regionName: string;
}

const financialMonthsMap = new Map([
  ['APR', 4], ['MAY', 5], ['JUN', 6], ['JUL', 7], ['AUG', 8], ['SEP', 9],
  ['OCT', 10], ['NOV', 11], ['DEC', 12], ['JAN', 1], ['FEB', 2], ['MAR', 3]
]);

const DrilldownModal: React.FC<DrilldownModalProps> = ({ isOpen, onClose, regionName }) => {
  const [chartData, setChartData] = useState<DrilldownYearlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

useEffect(() => {
  if (!isOpen || !regionName) return;

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchHistoricalYearsData(regionName);
      if (response.status && response.data) {
        const now = new Date();
        const currentFiscalYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
        const previousMonthDate = new Date(now.getFullYear(), now.getMonth(), 0);

        // Sort data by fiscal year (newest first) and take only last 3 years
        const sortedData = response.data.sort((a, b) => {
          const yearA = parseInt(a.Year.split('-')[1], 10);
          const yearB = parseInt(b.Year.split('-')[1], 10);
          return yearB - yearA; // Sort descending (newest first)
        });

        // Take only the last 3 years
        const lastThreeYearsData = sortedData.slice(0, 3);

        const processedData = lastThreeYearsData.map(yearData => {
          const startYear = parseInt(yearData.Year.split('-')[0], 10);
          if (startYear === currentFiscalYear) {
            yearData.months = yearData.months.filter(month => {
               const calendarMonthIndex = (financialMonthsMap.get(month.month.toUpperCase()) || 1) - 1;
               const calendarYear = calendarMonthIndex >= 3 ? startYear : startYear + 1;
               const monthDate = new Date(calendarYear, calendarMonthIndex, 1);
               return monthDate <= previousMonthDate;
            });
          }
          return yearData;
        });

        setChartData(processedData);
      } else {
        setError(response.message || 'Failed to load drill-down data.');
        setChartData([]);
      }
    } catch (err: any) {
      setError(err.code === 'ERR_NETWORK' ? 'Network Error' : 'An unexpected error occurred.');
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  fetchData();
}, [isOpen, regionName]);

const getChartOption = () => {
  const months = ['APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR'];
  const legendData = chartData.flatMap(yearData => [`${yearData.Year} Sales`, `${yearData.Year} Market Share`]);
  const colors = ['#0ABAB5', '#BA487F', '#F7B801'];

  // Calculate the max value across all sales data to determine appropriate scaling
  const allSalesValues = chartData.flatMap(yearData => 
    months.map(month => {
      const monthData = yearData.months.find(m => m.month.toUpperCase() === month);
      return monthData ? monthData.total_sales : 0;
    })
  ).filter(val => val > 0);
  
  const maxSalesValue = Math.max(...allSalesValues);

  // Smart formatter based on the data range
  const formatSalesValue = (value: number) => {
    if (value === 0) return '0';
    if (maxSalesValue < 10) {
      return value.toFixed(2); // Show decimal places for very small values
    } else if (maxSalesValue < 1000) {
      return value.toFixed(1); // Show one decimal for medium values
    } else if (value >= 1000000) {
      return `${(value/1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value/1000).toFixed(1)}K`;
    } else {
      return value.toFixed(0);
    }
  };

  const series = chartData.flatMap((yearData, index) => {
      const color = colors[index % colors.length];
      const salesData = months.map(month => {
          const monthData = yearData.months.find(m => m.month.toUpperCase() === month);
          return monthData ? monthData.total_sales : null;
      });
      const marketShareData = months.map(month => {
          const monthData = yearData.months.find(m => m.month.toUpperCase() === month);
          return monthData ? monthData.market_share_percentage : null;
      });

      return [
          {
              name: `${yearData.Year} Sales`,
              type: 'line',
              yAxisIndex: 0,
              data: salesData,
              smooth: true,
              itemStyle: { color: color },
              lineStyle: { width: 3 },
              symbol: 'circle',
              symbolSize: 8,
          },
          {
              name: `${yearData.Year} Market Share`,
              type: 'bar',
              yAxisIndex: 1,
              data: marketShareData,
              itemStyle: { color: color, opacity: 0.6 },
              barMaxWidth: 20,
          }
      ];
  });

  return {
      tooltip: { 
          trigger: 'axis',
          axisPointer: {
              type: 'cross',
              crossStyle: {
                  color: '#999'
              }
          },
          formatter: function(params: any) {
            let tooltipHtml = `<strong>${params[0].axisValue}</strong><br/>`;
            params.forEach((param: any) => {
              if (param.seriesName.includes('Sales')) {
                tooltipHtml += `${param.marker} ${param.seriesName}: ${formatSalesValue(param.value || 0)}<br/>`;
              } else {
                tooltipHtml += `${param.marker} ${param.seriesName}: ${(param.value || 0).toFixed(2)}%<br/>`;
              }
            });
            return tooltipHtml;
          }
      },
      legend: { 
          data: legendData,
          bottom: 10,
          textStyle: {
              color: '#333'
          }
      },
      xAxis: { 
          type: 'category', 
          data: months,
          axisPointer: {
              type: 'shadow'
          }
      },
      yAxis: [
          { 
              type: 'value', 
              name: 'Total Sales',
              axisLabel: { 
                  formatter: formatSalesValue
              }
          },
          { 
              type: 'value', 
              name: 'Market Share %', 
              axisLabel: { formatter: '{value}%' } 
          }
      ],
      series: series,
      grid: { top: 60, right: 50, bottom: 60, left: 60, containLabel: true }
  };
};

  const renderContent = () => {
    if (loading) {
      return <div className="flex flex-col items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /><p className="mt-4 text-gray-600">Loading Drill-down Data...</p></div>;
    }
    if (error) {
      return <div className="flex flex-col items-center justify-center h-full text-center text-red-600"><AlertCircle className="h-10 w-10 mb-2" /><p className="font-semibold">Failed to load data</p><p className="text-sm">{error}</p></div>;
    }
    if (chartData.length === 0) {
        return <div className="flex flex-col items-center justify-center h-full text-center text-gray-500"><AlertCircle className="h-10 w-10 mb-2" /><p className="font-semibold">No monthly data available</p><p className="text-sm">There is no drill-down data for the current selection.</p></div>;
    }
    return (
        <ReactECharts
            option={getChartOption()}
            style={{ height: '100%', width: '100%' }}
            notMerge={true}
        />
    );
  };

  if (!isOpen) return null;

  return (  
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl h-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b p-4">
          <h2 className="text-lg font-semibold text-gray-800">Monthly Performance for <span className="text-blue-600">{regionName}</span></h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 p-1 rounded-full hover:bg-gray-100" aria-label="Close drill-down modal"><X className="h-6 w-6" /></button>
        </div>
        <div className="flex-grow overflow-hidden p-4">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default DrilldownModal;


