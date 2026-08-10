import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { Filter, ChevronDown, X, AlertCircle, Search, Check, RefreshCw } from 'lucide-react';
import { fetchHistoricalYearsData, HistoricalFilters } from './services/performanceApi';
import { HistoricalSalesData, DrilldownYearlyData, FilterValues } from './types';
import { graphic } from 'echarts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/@/components/ui/dialog';

interface YearlyData {
  year: number;
  totalSales: number;
  months: HistoricalSalesData[];
}

interface FinancialPerformanceDashboardProps {
  filters?: FilterValues;
}

interface ZoneData {
  zone_name: string;
  total_sales: number;
  market_share_percentage: number;
}

interface DialogData {
  month: string;
  year: number;
  zones: ZoneData[];
  totalSales: number;
  marketShare: number;
}

// Default filter values to prevent undefined errors
const DEFAULT_FILTERS: HistoricalFilters = {
  sbu_name: 'RETAIL',
  zone_name: '',
  region_name: '',
  statename: '',
  productname: [],
  coname: 'HPCL',
  distname: ''
};

const financialMonthsMap = new Map([
  ['APR', 4], ['MAY', 5], ['JUN', 6], ['JUL', 7], ['AUG', 8], ['SEP', 9],
  ['OCT', 10], ['NOV', 11], ['DEC', 12], ['JAN', 1], ['FEB', 2], ['MAR', 3]
]);

const ColorLegend = () => ( 
  <div className="flex flex-wrap justify-center items-center gap-4 mt-3 text-gray-600">
    <div className="flex items-center gap-1.5">
      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#2dd4bf' }}></div>
      <span>High Performance</span>
    </div>
    <div className="flex items-center gap-1.5">
      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#60a5fa' }}></div>
      <span>Medium Performance</span>
    </div>
    <div className="flex items-center gap-1.5">
      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#fbbf24' }}></div>
      <span>Low Performance</span>
    </div>
    <div className="flex items-center gap-1.5">
      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#8b5cf6' }}></div>
      <span>Total</span>
    </div>
  </div>
);

const FinancialPerformanceDashboard: React.FC<FinancialPerformanceDashboardProps> = ({ filters }) => { 
  // Use default filters if none provided (excluding fiscal_year and month_name for historical analysis)
  const safeFilters = useMemo((): HistoricalFilters => {
    const baseFilters: HistoricalFilters = { 
      sbu_name: filters?.sbu_name || DEFAULT_FILTERS.sbu_name,
      coname: filters?.coname || DEFAULT_FILTERS.coname,
      zone_name: filters?.zone_name || DEFAULT_FILTERS.zone_name,
      region_name: filters?.region_name || DEFAULT_FILTERS.region_name,
      statename: filters?.statename || DEFAULT_FILTERS.statename,
      distname: filters?.distname || DEFAULT_FILTERS.distname,
      productname: filters?.productname || DEFAULT_FILTERS.productname,
      // Explicitly exclude fiscal_year and month_name for historical analysis
    };
    return baseFilters;
  }, [filters]);

  const [salesData, setSalesData] = useState<HistoricalSalesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [yearSearchTerm, setYearSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<DialogData | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const allYears = useMemo(() => Array.from(new Set(salesData.map(d => d.year))).sort(), [salesData]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchHistoricalYearsData(undefined, safeFilters);
    if (response.status && response.data) {
      const now = new Date();
      const previousMonthDate = new Date(now.getFullYear(), now.getMonth(), 0);

      const flattenedData = response.data.flatMap((yearlyData: DrilldownYearlyData) => {
        const startYear = parseInt(yearlyData.Year.split('-')[0], 10);
        
        return yearlyData.months
          .filter(month => {
            const calendarMonthIndex = (financialMonthsMap.get(month.month.toUpperCase()) || 1) - 1;
            const calendarYear = calendarMonthIndex >= 3 ? startYear : startYear + 1;
            const monthDate = new Date(calendarYear, calendarMonthIndex, 1);
            
            return monthDate <= previousMonthDate;
          })
          .map(month => ({
            year: startYear,
            month: financialMonthsMap.get(month.month.toUpperCase()) || 0,
            monthName: month.month,
            sales: month.total_sales,
            market_share_percentage: month.market_share_percentage,
            zones: month.zones, // Keep zones data for dialog
          }));
      });
      
      setSalesData(flattenedData);
      
      // Initially select all available years from filtered data
      const allYearsFromData = Array.from(new Set(flattenedData.map(d => d.year))).sort();
      setSelectedYears(allYearsFromData);
    } else {
      setError(response.message || 'Failed to load historical data.');
    }
    } catch (err: any) {
      console.error("API error fetching historical data:", err);
      if (err.response?.status === 500) {
        setError('Internal Server Error. Please check the API server.');
      } else if (err.code === 'ERR_NETWORK') {
        setError('Network Error: Unable to connect to server.');
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [safeFilters]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const yearlyData = useMemo(() => {
    const yearlyMap = new Map<number, YearlyData>();
    salesData.forEach(item => {
      if (!yearlyMap.has(item.year)) {
        yearlyMap.set(item.year, { year: item.year, totalSales: 0, months: [] });
      }
      const yearData = yearlyMap.get(item.year)!;
      yearData.totalSales += item.sales;
      yearData.months.push(item);
    });
    return Array.from(yearlyMap.values()).sort((a, b) => a.year - b.year);
  }, [salesData]);

  const handleYearToggle = (year: number) => {
    setSelectedYears(prev =>
      prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year].sort()
    );
  };

  const selectAllYears = () => {
    setSelectedYears([...allYears]);
  };

  const clearAllYears = () => {
    setSelectedYears([]);
  };

  const filteredYearsForDropdown = useMemo(() => {
    if (!yearSearchTerm) {
      return allYears;
    }
    return allYears.filter(year =>
      `FY ${year.toString().slice(-2)}-${(year + 1).toString().slice(-2)}`.toLowerCase().includes(yearSearchTerm.toLowerCase()) ||
      String(year).includes(yearSearchTerm)
    );
  }, [allYears, yearSearchTerm]);

  const handleBarClick = (params: any) => {
    if (params.componentType === 'series' && params.seriesType === 'bar') {
      const dataIndex = params.dataIndex;
      const shouldShowMonthlyView = selectedYears.length === 1;
      
      if (shouldShowMonthlyView) {
        // Monthly view - show zone details
        const yearData = yearlyData.find(yd => yd.year === selectedYears[0]);
        if (yearData && yearData.months[dataIndex]) {
          const monthData = yearData.months[dataIndex];
          setDialogData({
            month: monthData.monthName,
            year: monthData.year,
            zones: monthData.zones || [],
            totalSales: monthData.sales,
            marketShare: monthData.market_share_percentage
          });
          setDialogOpen(true);
        }
      }
    }
  };

  const getChartOptions = (data, isOverview = false) => {
    if (!data || data.length === 0) {
      return {
        title: {
          text: 'No Data Available',
          left: 'center',
          textStyle: { fontSize: 16, color: '#666' }
        },
        series: []
      };
    }
    let processedData = [];
    
    if (isOverview && Array.isArray(data)) {
      // For overview mode - yearly data
      processedData = data.map(yearData => ({
        name: `FY ${yearData.year.toString().slice(-2)}-${(yearData.year + 1).toString().slice(-2)}`,
        value: yearData.totalSales,
        year: yearData.year,
        monthsCount: yearData.months?.length || 0
      }));
      
      return getYearlyOverviewOptions(processedData);
    } else if (Array.isArray(data) && data.length > 0 && data[0].monthName) {
      // For monthly data - create waterfall chart
      return getMonthlyWaterfallOptions(data);
    }
    
    return {};
  };

const getYearlyOverviewOptions = (yearlyData) => { 
    if (yearlyData.length === 0) return {};
    
    // Calculate differences for waterfall effect
    const data = [];
    const categories = [];
    for (let i = 0; i < yearlyData.length; i++) {  
      const currentSales = yearlyData[i].value;
      const previousSales = i > 0 ? yearlyData[i - 1].value : 0;
      const difference = i === 0 ? currentSales : currentSales - previousSales;
      categories.push(yearlyData[i].name);
      data.push(difference);
    }
    
    // Calculate helper arrays for waterfall effect
    const help = [];
    const positive = [];
    const negative = [];
    const labels = [];
    let sum = 0;
    
    for (let i = 0; i < data.length; i++) {
      const value = data[i];
      const totalSales = yearlyData[i].value;
      
      // Use exact value if below 10, otherwise round
      const salesLabel = totalSales < 10 ? totalSales.toFixed(2) : Math.round(totalSales).toString();
      labels.push(salesLabel);
      
      if (value >= 0) {  
        positive.push(value);
        negative.push('-');
      } else {
        positive.push('-');
        negative.push(Math.abs(value));
      }
      
      if (i === 0) {
        help.push(0);
      } else {
        sum += data[i - 1];
        if (value < 0) {
          help.push(sum + value);
        } else {
          help.push(sum);
        }
      }
    }

    // Dynamic scale calculation - always start from 0
    const allValues = yearlyData.map(item => item.value);
    const maxValue = Math.max(...allValues);
    const padding = maxValue * 0.1;

    return {
      title: {
        text: 'Yearly Sales Waterfall Chart',
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: function(params) {
          const dataIndex = params[0].dataIndex;
          const yearData = yearlyData[dataIndex];
          const difference = data[dataIndex];
          // Show exact values without rounding
          return `
            <div style="padding: 8px;">
              <div style="font-weight: bold; margin-bottom: 4px;">${yearData.name}</div>
              <div>Total Sales: ${yearData.value.toFixed(2)} TMT</div>
              <div>Difference: ${difference >= 0 ? '+' : ''}${difference.toFixed(2)} TMT</div>
              <div>Months: ${yearData.monthsCount}</div>
            </div>
          `;
        }
      },
      grid: {
        left: '5%',
        right: '5%',
        bottom: '15%',
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: {
          rotate: 45,
          fontSize: 12
        },
        splitLine: { 
          show: false 
        }
      },
      yAxis: {
        type: 'value',
        nameLocation: 'middle',
        nameGap: 40,
        min: 0,
        max: Math.ceil(maxValue + padding),
        splitLine: {
          show: true,
          lineStyle: {
            type: 'dashed',
            color: '#e0e0e0'
          }
        },
        axisLabel: {
          formatter: function(value) {
            // Format based on value size
            if (value < 10) {
              return value.toFixed(1) + ' TMT';
            }
            return Math.round(value) + ' TMT';
          }
        }
      },
      series: [
        {
          name: 'helper',
          type: 'bar',
          stack: 'total',
          silent: true,
          barMinWidth: 30,    
          barMaxWidth: 35,
          itemStyle: {
            borderColor: 'transparent',
            color: 'transparent',
            borderRadius: [8, 8, 0, 0]
          },
          emphasis: {
            itemStyle: {
              borderColor: 'transparent',
              color: 'transparent'
            }
          },
          data: help
        },
        {
          name: 'Increase',
          type: 'bar',
          stack: 'total',
          barMinWidth: 30,
          barMaxWidth: 35,
          itemStyle: {
            color: new graphic.LinearGradient(0, 0, 0, 1, [
              {
                offset: 0,
                color: '#3cb568'
              },
              {
                offset: 1,
                color: '#50b202'
              }
            ]),
            borderRadius: [8, 8, 0, 0]
          },
          data: positive,
          label: {
            show: true,
            position: 'top',
            formatter: function(params) {
              return params.value !== '-' ? labels[params.dataIndex] : '';
            },
            fontSize: 10,
            color: '#333',
            fontWeight: 'normal'
          }
        },
        {
          name: 'Decrease',
          type: 'bar',
          stack: 'total',
          barMinWidth: 30,
          barMaxWidth: 35,
          itemStyle: {
            color: new graphic.LinearGradient(0, 0, 0, 1, [
              {
                offset: 0,
                color: '#d95f5f'
              },
              {
                offset: 1,
                color: '#b30000'
              }
            ]),
            borderRadius: [0, 0, 8, 8]
          },
          data: negative,
          label: {
            show: true,
            position: 'top',
            formatter: function(params) {
              return params.value !== '-' ? labels[params.dataIndex] : '';
            },
            fontSize: 10,
            color: '#333',
            fontWeight: 'normal'
          }
        }
      ],
      legend: {
        data: ['Increase', 'Decrease'],
        bottom: '5%',
        left: 'center'
      }
    };
  };

const getMonthlyWaterfallOptions = (monthlyData) => {  
  if (!monthlyData || monthlyData.length === 0) {
    return {};
  }

  // Sort data by month order for proper waterfall display
  const sortedData = [...monthlyData].sort((a, b) => { 
    const monthOrderMap = {
      'APR': 1, 'MAY': 2, 'JUN': 3, 'JUL': 4, 'AUG': 5, 'SEP': 6,
      'OCT': 7, 'NOV': 8, 'DEC': 9, 'JAN': 10, 'FEB': 11, 'MAR': 12
    };
    return (monthOrderMap[a.monthName] || 0) - (monthOrderMap[b.monthName] || 0);
  });

  // Calculate differences for waterfall effect
  const data = [];
  const categories = [];
  
  for (let i = 0; i < sortedData.length; i++) { 
    const currentSales = sortedData[i].sales;
    const previousSales = i > 0 ? sortedData[i - 1].sales : 0;
    const difference = i === 0 ? currentSales : currentSales - previousSales;
    
    categories.push(sortedData[i].monthName);
    data.push(difference);
  }

  // Calculate helper arrays for waterfall effect
  const help = [];
  const positive = [];
  const negative = [];
  const labels = [];
  
  let sum = 0;
  
  for (let i = 0; i < data.length; i++) {
    const value = data[i];
    const totalSales = sortedData[i].sales;
    
    // Use exact value if below 10, otherwise round
    const salesLabel = totalSales < 10 ? totalSales.toFixed(2) : Math.round(totalSales).toString();
    labels.push(salesLabel);
    
    if (value >= 0) {
      positive.push(value);
      negative.push('-');
    } else {
      positive.push('-');
      negative.push(Math.abs(value));
    }
    
    if (i === 0) {
      help.push(0);
    } else {
      sum += data[i - 1];
      if (value < 0) {
        help.push(sum + value);
      } else {
        help.push(sum);
      }
    }
  }

  const year = sortedData[0]?.year || new Date().getFullYear();

  // Dynamic scale calculation - always start from 0
  const allValues = sortedData.map(item => item.sales);
  const maxValue = Math.max(...allValues);
  const padding = maxValue * 0.1;

  return {
    title: {
      text: `Monthly Sales Waterfall Chart - FY ${year.toString().slice(-2)}-${(year + 1).toString().slice(-2)}`,
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold'
      }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: function(params) {
        const dataIndex = params[0].dataIndex;
        const monthData = sortedData[dataIndex];
        const difference = data[dataIndex];
        
        // Show exact values without rounding
        return `
          <div style="padding: 8px;">
            <div style="font-weight: bold; margin-bottom: 4px;">${monthData.monthName}</div>
            <div>Total Sales: ${monthData.sales.toFixed(2)} TMT</div>
            <div>Difference: ${difference >= 0 ? '+' : ''}${difference.toFixed(2)} TMT</div>
            <div>Market Share: ${monthData.market_share_percentage?.toFixed(2) || 0}%</div>
            <div style="margin-top: 4px; font-size: 12px; color: #666;">Click for zone details</div>
          </div>
        `;
      }
    },
    grid: {
      left: '5%',
      right: '5%',
      bottom: '15%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        rotate: 45,
        fontSize: 12
      },
      splitLine: { 
        show: false 
      }
    },
    yAxis: {
      type: 'value',
      nameLocation: 'middle',
      nameGap: 40,
      min: 0,
      max: Math.ceil(maxValue + padding),
      splitLine: {
        show: true,
        lineStyle: {
          type: 'dashed',
          color: '#e0e0e0'
        }
      },
      axisLabel: {
        formatter: function(value) {
          // Format based on value size
          if (value < 10) {
            return value.toFixed(1) + ' TMT';
          }
          return Math.round(value) + ' TMT';
        }
      }
    },
    series: [
      {
        name: 'helper',
        type: 'bar',
        stack: 'total',
        barMinWidth: 30,
        barMaxWidth: 35,
        silent: true,
        itemStyle: {
          borderColor: 'transparent',
          color: 'transparent',
          borderRadius: [8, 8, 0, 0] 
        },
        emphasis: {
          itemStyle: {
            borderColor: 'transparent',
            color: 'transparent'
          }
        },
        data: help
      },
      {
        name: 'Increase',
        type: 'bar',
        stack: 'total',
        barMinWidth: 30,
        barMaxWidth: 35,
        itemStyle: {
          color: new graphic.LinearGradient(0, 0, 0, 1, [
            {
              offset: 0,
              color: '#3cb568'
            },
            {
              offset: 1,
              color: '#50b202'
            }
          ]),
          borderRadius: [8, 8, 0, 0]
        },
        data: positive,
        label: {
          show: true,
          position: 'top',
          formatter: function(params) {
            return params.value !== '-' ? labels[params.dataIndex] : '';
          },
          fontSize: 10,
          color: '#333',
          fontWeight: 'normal'
        }
      },
      {
        name: 'Decrease',
        type: 'bar',
        stack: 'total',
        barMinWidth: 30,
        barMaxWidth: 35,
        itemStyle: {
          color: new graphic.LinearGradient(0, 0, 0, 1, [
            {
              offset: 0,
              color: '#d95f5f'
            },
            {
              offset: 1,
              color: '#b30000'
            }
          ]),
          borderRadius: [0, 0, 8, 8]
        },
        data: negative,
        label: {
          show: true,
          position: 'top',
          formatter: function(params) {
            return params.value !== '-' ? labels[params.dataIndex] : '';
          },
          fontSize: 10,
          color: '#333',
          fontWeight: 'normal'
        }
      }
    ],
    legend: {
      data: ['Increase', 'Decrease'],
      bottom: '5%',
      left: 'center'
    }
  };
};

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600"></div></div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center text-red-600">
        <AlertCircle className="h-10 w-10 mb-2" />
        <p className="font-semibold">Failed to load data</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  // Determine what to show in the main chart based on selected years
  const shouldShowMonthlyView = selectedYears.length === 1;
  const mainChartData = shouldShowMonthlyView 
    ? yearlyData.find(yd => yd.year === selectedYears[0])?.months || []
    : yearlyData.filter(yd => selectedYears.includes(yd.year));

  return (
    <div className="mt-2 border-t border-gray-200 pt-2">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">
            Historical Performance Analysis
          </h1>
          <p className="text-sm text-gray-600">
            {safeFilters.region_name ? `Region: ${safeFilters.region_name} • ` : ''}
            {safeFilters.zone_name ? `Zone: ${safeFilters.zone_name} • ` : ''}
            {safeFilters.distname ? `District: ${safeFilters.distname} • ` : ''}
            {selectedYears.length === 0 ? 'All Years' : selectedYears.map(y => `FY ${y.toString().slice(-2)}`).join(', ')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-700 rounded-md transition-colors"
            title="Refresh Historical Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="relative w-56" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full bg-blue-50 text-blue-700 px-3 py-2 rounded-md text-sm font-medium text-left flex items-center justify-between hover:bg-blue-100 transition-colors border border-blue-200"
            >
              <span className="truncate">{selectedYears.length === 0 ? 'All Years Selected' : `${selectedYears.length} Selected`}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {isDropdownOpen && (  
              <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 flex flex-col w-56">
                <div className="sticky top-0 bg-gray-50 px-3 py-2 border-b text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-600">{selectedYears.length} selected</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={selectAllYears} 
                        className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                      >
                        Select All
                      </button>
                      {selectedYears.length > 0 && (
                        <button 
                          onClick={clearAllYears} 
                          className="text-red-600 hover:text-red-700 text-xs font-medium"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="p-2 border-b border-gray-200">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search Year..."
                      className="w-full pl-7 pr-2 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      value={yearSearchTerm}
                      onChange={(e) => setYearSearchTerm(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
                <div className="overflow-y-auto max-h-48">
                  {filteredYearsForDropdown.length > 0 ? (
                    filteredYearsForDropdown.map((year) => (
                      <button
                        key={year}
                        onClick={() => handleYearToggle(year)}
                        className={`w-full px-3 py-2 text-xs text-left hover:bg-gray-50 transition-colors flex items-center justify-between ${selectedYears.includes(year) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                      >
                        <span>FY {year.toString().slice(-2)}-{(year + 1).toString().slice(-2)}</span>
                        {selectedYears.includes(year) && <Check className="h-3 w-3 text-blue-600" />}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-xs text-center text-gray-500">
                      No results found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
        <ReactECharts 
          option={getChartOptions(mainChartData, !shouldShowMonthlyView)} 
          style={{ height: '500px', width: '100%' }} 
          opts={{ renderer: 'svg' }} 
          onEvents={{
            'click': handleBarClick
          }}
        />
      </div>

      {/* Show individual year charts only when multiple years are selected */}
      {selectedYears.length > 1 && ( 
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {selectedYears.map((year, index) => { 
            const isLastAndOdd = (index === selectedYears.length - 1) && (selectedYears.length % 2 !== 0);
            const dataForYear = yearlyData.find(yd => yd.year === year)?.months || [];
            return ( 
              <div 
                key={year} 
                className={`bg-white rounded-xl shadow-lg p-4 border border-gray-100 ${isLastAndOdd ? 'lg:col-span-2' : ''}`}
              >
                <ReactECharts
                  option={getChartOptions(dataForYear, false)}
                  style={{ height: '400px', width: '100%' }}
                  opts={{ renderer: 'svg' }}
                  onEvents={{
                    'click': (params) => {
                      if (params.componentType === 'series' && params.seriesType === 'bar') {
                        const dataIndex = params.dataIndex;
                        const monthData = dataForYear[dataIndex];
                        if (monthData) {
                          setDialogData({
                            month: monthData.monthName,
                            year: monthData.year,
                            zones: monthData.zones || [],
                            totalSales: monthData.sales,
                            marketShare: monthData.market_share_percentage
                          });
                          setDialogOpen(true);
                        }
                      }
                    }
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Zone Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              Zone-wise Details - {dialogData?.month} FY{dialogData?.year?.toString().slice(-2)}-{((dialogData?.year || 0) + 1).toString().slice(-2)}
            </DialogTitle>
            <DialogDescription>
              Total Sales: {Math.round(dialogData?.totalSales || 0)} TMT | Market Share: {dialogData?.marketShare?.toFixed(2)}%
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            {dialogData?.zones && dialogData.zones.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4 font-semibold text-sm text-gray-700 border-b pb-2">
                  <div>Zone</div>
                  <div className="text-right">Sales</div>
                  <div className="text-right">Market Share</div>
                </div>
                
                {dialogData.zones
                  .sort((a, b) => b.total_sales - a.total_sales)
                  .map((zone, index) => (
                    <div 
                      key={zone.zone_name} 
                      className={`grid grid-cols-3 gap-4 py-2 text-sm ${
                        index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                      } rounded px-2`}
                    >
                      <div className="font-medium text-gray-800">{zone.zone_name}</div>
                      <div className="text-right text-gray-700">
                        {Math.round(zone.total_sales)} TMT
                      </div>
                      <div className="text-right text-gray-700">
                        {zone.market_share_percentage?.toFixed(2)}%
                      </div>
                    </div>
                  ))
                }
                
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <div className="grid grid-cols-3 gap-4 font-semibold text-gray-900">
                    <div>Total</div>
                    <div className="text-right">
                      {Math.round(dialogData.zones.reduce((sum, zone) => sum + zone.total_sales, 0))} TMT
                    </div>
                    <div className="text-right">
                      {dialogData.zones.reduce((sum, zone) => sum + (zone.market_share_percentage || 0), 0).toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                No zone data available for this month
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>  
  );
};

export default FinancialPerformanceDashboard;