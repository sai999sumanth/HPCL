import React, { useState } from 'react';
import { ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,   PieChart as RechartPieChart, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { BarChart3, DollarSign, LineChart } from 'lucide-react';
import { Card, CardContent } from '../../@/components/ui/card';

const cloudProviderImages = {
    AWS: 'https://www.svgrepo.com/show/448266/aws.svg',
    Azure: 'https://www.svgrepo.com/show/448274/azure.svg',
    GCP: 'https://www.svgrepo.com/show/448223/gcp.svg',
    OCI: 'https://www.svgrepo.com/show/448245/oracle.svg',
  };

const TotalSavingsSection = ({ selectedProvider = null }) => {
    const alertData = {
      total: 100,
      providers: [
        { 
          name: 'AWS', 
          count: 45, 
          openAlerts: 30,
          closedAlerts: 15,
          critical: 20,
          inProgress: 5,
          resolved: 5,
          cpu: '83.2%', 
          gib: '72.3%', 
          savings: 12500 
        },
        { 
          name: 'Azure', 
          count: 20, 
          openAlerts: 15,
          closedAlerts: 5,
          critical: 8,
          inProgress: 3,
          resolved: 2,
          cpu: '79.1%', 
          gib: '70.2%', 
          savings: 7200 
        },
        { 
          name: 'GCP', 
          count: 25, 
          openAlerts: 18,
          closedAlerts: 7,
          critical: 10,
          inProgress: 4,
          resolved: 3,
          cpu: '76.5%', 
          gib: '68.9%', 
          savings: 8300 
        },
        { 
          name: 'OCI', 
          count: 10, 
          openAlerts: 7,
          closedAlerts: 3,
          critical: 4,
          inProgress: 2,
          resolved: 1,
          cpu: '81.4%', 
          gib: '71.8%', 
          savings: 4500 
        }
      ]
    };
  
    const displayData = selectedProvider 
      ? alertData.providers.filter(p => p.name === selectedProvider)
      : alertData.providers;
  
    const totalSavings = displayData.reduce((sum, provider) => sum + provider.savings, 0);
  
    return (
      <CardContent className="p-1 mb-2">
        <div className="grid grid-cols-4 gap-3">
          {displayData.map((provider) => (
            <Card key={provider.name} className="bg-white shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <img 
                      src={cloudProviderImages[provider.name]}
                      alt={`${provider.name} logo`}
                      className="w-6 h-6"
                    />
                    <span className="font-semibold text-base">{provider.name}</span>
                  </div>
                  <div className="flex items-center gap-1 text-green-600">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-lg font-bold">
                      {provider.savings.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Total Alerts</span>
                    <span className="text-sm font-semibold">{provider.count}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Open</span>
                    <span className="text-sm font-semibold text-blue-600">{provider.openAlerts}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Closed</span>
                    <span className="text-sm font-semibold text-yellow-600">{provider.closedAlerts}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    );
  };

const generateOverviewData = (categories) => {
  const allData = categories.flatMap(category => 
    category.data.map(item => ({
      ...item,
      category: `${category.label.split(' ')[1]} - ${item.category}`.trim()
    }))
  );
  return allData;
};

const categories = [
  {
    id: 'recommendationType',
    label: 'By Recommendation Type',
    data: [
      { category: 'shutdowned_instance ', cost: 2144.50, savings: 1679.75, realized: 1775.00, suppressed: 1000 },
      { category: 'unused_stream ', cost: 2997, savings: 1500, realized: 2211, suppressed: 1200 },
      { category: 'unused_ip', cost: 2293, savings: 2222, realized: 3661, suppressed: 800 },
      { category: 'reduce_vcpus', cost: 838, savings: 1111, realized: 221, suppressed: 900 }
    ]
  },
  {
    id: 'resourceType',
    label: 'By Resource Type',
    data: [
      { category: 'Kinesis', cost: 2144.50, savings: 1679.75, realized: 1775.00, suppressed: 1400 },
      { category: 'ApiGateways', cost: 2600, savings: 1900, realized: 1400, suppressed: 900 },
      { category: 'Instance', cost: 860, savings: 1600, realized: 1700, suppressed: 1100 },
      { category: 'NatGateways', cost: 2400, savings: 1700, realized: 1200, suppressed: 700 }
    ]
  },
  {
    id: 'region',
    label: 'By Region',
    data: [
      { category: 'US East', cost: 2144.50, savings: 1679.75, realized: 1775.00, suppressed: 1300 },
      { category: 'US West', cost: 2500, savings: 2717, realized: 1500, suppressed: 900 },
      { category: 'EU West', cost: 1678, savings: 278, realized: 2000, suppressed: 1200 },
      { category: 'Asia Pacific', cost: 3400, savings: 2324, realized: 1500, suppressed: 700 }
    ]   
  }
];

const overviewCategory = {
  id: 'overview',
  label: 'Overview',
  data: generateOverviewData(categories)
};

const allCategories = [overviewCategory, ...categories];

const metricDefinitions = [
    { label: 'COST', key: 'cost', color: '#0066FF', checkboxLabel: 'RECOMMENDATION 1' },
    { label: 'SAVINGS', key: 'savings', color: '#93c5fd', checkboxLabel: 'RECOMMENDATION 2' },
    { label: 'REALIZED', key: 'realized', color: '#86efac', checkboxLabel: 'RECOMMENDATION 3' },
    { label: 'SUPPRESSED', key: 'suppressed', color: '#fca5a5', checkboxLabel: 'RECOMMENDATION 4' }
  ];

  const recommendations = [
    { 
      id: 'recommendation1',
      label: 'RECOMMENDATION 1',
      metrics: [
        { label: 'COST', key: 'cost1', color: '#0066FF' },
        { label: 'SAVINGS', key: 'savings1', color: '#93c5fd' },
        { label: 'REALIZED', key: 'realized1', color: '#86efac' },
        { label: 'SUPPRESSED', key: 'suppressed1', color: '#fca5a5' }
      ]
    },
    {
      id: 'recommendation2',
      label: 'RECOMMENDATION 2',
      metrics: [
        { label: 'COST', key: 'cost2', color: '#0066FF' },
        { label: 'SAVINGS', key: 'savings2', color: '#93c5fd' },
        { label: 'REALIZED', key: 'realized2', color: '#86efac' },
        { label: 'SUPPRESSED', key: 'suppressed2', color: '#fca5a5' }
      ]
    },
    {
      id: 'recommendation3',
      label: 'RECOMMENDATION 3',
      metrics: [
        { label: 'COST', key: 'cost3', color: '#0066FF' },
        { label: 'SAVINGS', key: 'savings3', color: '#93c5fd' },
        { label: 'REALIZED', key: 'realized3', color: '#86efac' },
        { label: 'SUPPRESSED', key: 'suppressed3', color: '#fca5a5' }
      ]
    },
    {
      id: 'recommendation4',
      label: 'RECOMMENDATION 4',
      metrics: [
        { label: 'COST', key: 'cost4', color: '#0066FF' },
        { label: 'SAVINGS', key: 'savings4', color: '#93c5fd' },
        { label: 'REALIZED', key: 'realized4', color: '#86efac' },
        { label: 'SUPPRESSED', key: 'suppressed4', color: '#fca5a5' }
      ]
    }
  ];
  
  const ageRanges = [
    { label: '0-30 days', key: '30d', color: '#22c55e' },
    { label: '31-60 days', key: '60d', color: '#eab308' },
    { label: '61-90 days', key: '90d', color: '#f97316' },
    { label: '90+ days', key: '90plus', color: '#ef4444' }
  ];
  
  // Simulate aging data by distributing the values across age ranges
  const addAgingData = (data) => {
    return data.map(item => {
      const agingDistribution = {
        '30d': 0.4, // 40% of total in 0-30 days
        '60d': 0.3, // 30% of total in 31-60 days
        '90d': 0.2, // 20% of total in 61-90 days
        '90plus': 0.1 // 10% of total in 90+ days
      };
  
      const aging = {};
      Object.keys(agingDistribution).forEach(range => {
        aging[`cost_${range}`] = item.cost * agingDistribution[range];
        aging[`savings_${range}`] = item.savings * agingDistribution[range];
        aging[`realized_${range}`] = item.realized * agingDistribution[range];
        aging[`suppressed_${range}`] = item.suppressed * agingDistribution[range];
      });
  
      return {
        ...item,
        ...aging
      };
    });
  };
  
  const DashboardGraph = () => {
    const [activeCategory, setActiveCategory] = useState({
      ...allCategories[0],
      data: addAgingData(allCategories[0].data)
    });
    const [chartType, setChartType] = useState('line');
    const [selectedMetrics, setSelectedMetrics] = useState(
      metricDefinitions.map(m => m.key)
    );
    const [selectedAgeRange, setSelectedAgeRange] = useState('30d');

    const calculateYAxisDomain = () => {
      if (!selectedMetrics.length) return [0, 0];
      
      const allValues = activeCategory.data.flatMap(item =>
        selectedMetrics.map(metric => item[`${metric}_${selectedAgeRange}`])
      ).filter(Boolean);
  
      const maxValue = Math.max(...allValues);
      const minValue = Math.min(...allValues);
      
      // Add 10% padding to the top
      const topPadding = (maxValue - minValue) * 0.1;
      
      return [0, Math.ceil((maxValue + topPadding) / 1000) * 1000];
    };

    const formatYAxis = (value) => {
      return `$${value.toLocaleString()}`;
    };
  
    const handleCategoryChange = (category) => {
      setActiveCategory({
        ...category,
        data: addAgingData(category.data)
      });
    };
  
    const handleMetricToggle = (metricKey) => {
      if (metricKey === 'all') {
        if (selectedMetrics.length === metricDefinitions.length) {
          setSelectedMetrics([]);
        } else {
          setSelectedMetrics(metricDefinitions.map(m => m.key));
        }
      } else {
        if (selectedMetrics.includes(metricKey)) {
          setSelectedMetrics(selectedMetrics.filter(m => m !== metricKey));
        } else {
          setSelectedMetrics([...selectedMetrics, metricKey]);
        }
      }
    };
  
    const CustomTooltip = ({ active, payload, label }) => {
      if (active && payload && payload.length) {
        return (
          <div className="bg-white p-3 shadow-lg rounded-lg border text-xs">
            <p className="font-medium">{label}</p>
            {payload.map((entry, index) => {
              const baseMetricKey = entry.dataKey.split('_')[0];
              const metric = metricDefinitions.find(m => m.key === baseMetricKey);
              return (
                <p key={index} style={{ color: metric?.color }} className="flex justify-between gap-4">
                  <span>{metric?.label}:</span>
                  <span className="font-medium">${entry.value.toLocaleString()}</span>
                </p>
              );
            })}
          </div>
        );
      }
      return null;
    };
  
    const calculateAverages = (data) => {
      const sums = data.reduce((acc, item) => ({
        cost: acc.cost + item[`cost_${selectedAgeRange}`],
        savings: acc.savings + item[`savings_${selectedAgeRange}`],
        realized: acc.realized + item[`realized_${selectedAgeRange}`],
        suppressed: acc.suppressed + item[`suppressed_${selectedAgeRange}`]
      }), { cost: 0, savings: 0, realized: 0, suppressed: 0 });
  
      const count = data.length;
      return {
        cost: (sums.cost / count).toFixed(2),
        savings: (sums.savings / count).toFixed(2),
        realized: (sums.realized / count).toFixed(2),
        suppressed: (sums.suppressed / count).toFixed(2)
      };
    };
  
    const averages = calculateAverages(activeCategory.data);
    const metrics = metricDefinitions.map(metric => ({
      ...metric,
      value: averages[metric.key]
    }));
  
    const AgingSelector = () => (
        <div className="flex gap-2 items-center">
          {ageRanges.map((range) => (
            <button
              key={range.key}
              onClick={() => setSelectedAgeRange(range.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all
                ${selectedAgeRange === range.key 
                  ? 'bg-blue-50 text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:bg-gray-50'
                }
                flex items-center gap-2`}
            >
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: range.color }}
              />
              {range.label}
            </button>
          ))}
        </div>
      );
    
      const ChartTypeSelector = () => (
        <div className="flex gap-2">
          <button
            onClick={() => setChartType('line')}
            className={`p-1.5 rounded transition-all ${
              chartType === 'line' 
                ? 'bg-gray-100 text-blue-600' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <LineChart size={20} />
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`p-1.5 rounded transition-all ${
              chartType === 'bar' 
                ? 'bg-gray-100 text-blue-600' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <BarChart3 size={20} />
          </button>
        </div>
      );
    
      const MetricCheckboxes = () => (
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={selectedMetrics.length === metricDefinitions.length}
              onChange={() => handleMetricToggle('all')}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="font-medium">ALL</span>
          </label>
          {metrics.map((metric) => (
            <label key={metric.key} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={selectedMetrics.includes(metric.key)}
                onChange={() => handleMetricToggle(metric.key)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span style={{ color: metric.color }} className="font-medium">
                {metric.checkboxLabel}
              </span>
            </label>
          ))}
        </div>
      );
    
      const renderChart = () => {
        if (!selectedMetrics.length) {
          return (
            <div className="h-full flex items-center justify-center text-gray-400">
              Select metrics to display data
            </div>
          );
        }
    
        const [minDomain, maxDomain] = calculateYAxisDomain();
    
        return (
          <ResponsiveContainer width="100%" height="130%">
            <ComposedChart data={activeCategory.data}>
              <XAxis 
                dataKey="category" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                textAnchor="middle"
                height={60}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                domain={[minDomain, maxDomain]}
                tickFormatter={formatYAxis}
                width={80}
              />
              <Tooltip content={<CustomTooltip active={undefined} payload={undefined} label={undefined} />} />
              
              {selectedMetrics.map(metricKey => {
                const metric = metricDefinitions.find(m => m.key === metricKey);
                return chartType === 'line' ? (
                  <Line
                    key={metric.key}
                    type="monotone"
                    dataKey={`${metric.key}_${selectedAgeRange}`}
                    name={metric.label}
                    stroke={metric.color}
                    strokeWidth={2}
                    dot={{ fill: metric.color }}
                    animationDuration={1000}
                  />
                ) : (
                  <Bar
                    key={metric.key}
                    dataKey={`${metric.key}_${selectedAgeRange}`}
                    name={metric.label}
                    fill={metric.color}
                    radius={[4, 4, 0, 0]}
                    animationDuration={1000}
                  />
                );
              })}
            </ComposedChart>
          </ResponsiveContainer>
        );
      };
    
  
    return (
        <div className="w-full mb-7 font-inter">
            <TotalSavingsSection />
          {/* Top section with tabs and aging selector */}
          <div className="mb-6 flex justify-between items-center border-b border-gray-200">
            <div className="flex space-x-6">
              {allCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleCategoryChange(category)}
                  className={`pb-2 text-sm transition-colors relative ${
                    activeCategory.id === category.id
                    ? 'text-blue-600 font-medium'
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {category.label}
                  {activeCategory.id === category.id && (
                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>
                  )}
                </button>
              ))}
            </div>
            <AgingSelector />
          </div>
    
          {/* Controls section */}
          <div className="flex justify-end gap-4 items-center mb-6">
            <MetricCheckboxes />
            <ChartTypeSelector />
          </div>
    
          {/* Main content section */}
          <div className="flex">
            <div className="w-64 space-y-6 pr-8">
              {metrics.map((metric, index) => (
                <div key={index} className="flex flex-col">
                  <div className="text-xs text-gray-500 tracking-wide">
                    {metric.label}
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <div className="w-1 h-6 rounded" style={{ backgroundColor: metric.color }}></div>
                    <span className="text-lg text-gray-500">$</span>
                    <span className="text-2xl font-medium">
                      {selectedMetrics.includes(metric.key) ? 
                        Number(metric.value).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        }) : 
                        '0.00'
                      }
                    </span>
                  </div>
                </div>
              ))}
            </div>
    
            <div className="flex-1">
              <div className="h-64">
                {renderChart()}
              </div>
            </div>
          </div>
        </div>
      );
    };
    
    export default DashboardGraph;