import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../../@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import DashboardGraph from './graph';

const Dashboard = () => {
  const metrics = {
    present: {
      total: 494,
      closed: 245,
      open: 182,
      surpassed: 67,
      distribution: [
        { name: 'Critical', value: 82, color: '#f43f5e' },
        { name: 'Medium', value: 60, color: '#8b5cf6' },
        { name: 'Low', value: 40, color: '#06b6d4' }
      ]
    },
    previous: {
      total: 399,
      closed: 198,
      open: 156,
      surpassed: 45,
      distribution: [
        { name: 'Critical', value: 48, color: '#f43f5e' },
        { name: 'Medium', value: 70, color: '#8b5cf6' },
        { name: 'Low', value: 80, color: '#06b6d4' }
      ]
    }
  };

  const MetricItem = ({ label, value, color = 'blue-600', isTotal = false }) => (
    <div className="flex items-center gap-3">
      <div className={`h-10 w-1 rounded-full bg-${color}`} />
      <div className="flex flex-col">
        <span className="text-[8px] font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
        <span className={`${
          isTotal 
            ? 'text-4xl font-mono' 
            : 'text-2xl font-sans'
        } font-bold`}>
          {value}
        </span>
      </div>
    </div>
  );

  // Updated CustomLegend to use total alerts for progress bar calculation
  const CustomLegend = ({ data, totalAlerts }) => (
    <div className="flex flex-col gap-1 pl-2 flex-1">
      {data.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors duration-200">
          <div 
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs font-medium text-gray-700 min-w-20">
            {entry.name}
          </span>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold" style={{ color: entry.color }}>
                {entry.value}
              </span>
              <span className="text-xs text-gray-400">alerts</span>
            </div>
            <div className="w-16 h-1 rounded-full bg-gray-100 overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-300"
                style={{ 
                  backgroundColor: entry.color,
                  width: `${(entry.value / totalAlerts) * 100}%`
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const DonutCard = ({ title, data, metrics, type }) => {
    const DonutMetricItem = ({ label, value, color }) => (
      <div className="flex items-center gap-3">
        <div className="h-10 w-1 rounded-full" style={{ backgroundColor: color }} />
        <div className="flex flex-col">
          <span className="text-[8px] font-semibold text-gray-500 uppercase tracking-wider">
            {label}
          </span>
          <span className="text-2xl font-sans font-bold">
            {value}
          </span>
        </div>
      </div>
    );

    return (
      <Card className="flex-1 border-0 shadow-lg bg-white hover:shadow-md transition-shadow duration-300">
        <CardHeader className="pb-2 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardTitle className="text-lg font-semibold text-gray-800">{title}</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex">
            <div className="flex flex-col gap-9 w-1/4">
              <DonutMetricItem 
                label="Total Alerts"
                value={metrics.total} 
                color="#3b82f6"
              />
              {type === 'open' ? (
                <DonutMetricItem 
                  label="Open Alerts" 
                  value={metrics.open} 
                  color="#eab308"
                />
              ) : (
                <DonutMetricItem 
                  label="Closed Alerts" 
                  value={metrics.closed} 
                  color="#22c55e"
                />
              )}
            </div>
            <div className="flex items-center w-3/4">
              <div className="w-32 h-32 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data}
                      innerRadius="60%"
                      outerRadius="90%"
                      paddingAngle={5}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {data.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color}
                          className="hover:opacity-80 transition-opacity duration-300"
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <CustomLegend data={data} totalAlerts={metrics.total} />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const MetricsCard = ({ title, metrics, isPrevious }) => (
    <Card className="flex-1 border-0 shadow-md bg-white hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="pb-2 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardTitle className="text-md font-semibold text-gray-800">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <div className="flex items-center gap-1">
          <div className="flex-1">
            <MetricItem 
              label="Total Alerts" 
              value={metrics.total} 
              color="blue-600"
              isTotal={true}
            />
          </div>
          <div className="flex items-center gap-6">
            <MetricItem label="Closed" value={metrics.closed} color="green-500" />
            <MetricItem label="Open" value={metrics.open} color="yellow-500" />
            <MetricItem label="Surpassed" value={metrics.surpassed} color="red-500" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-4 p-2">
      <div className="flex gap-4">
        <MetricsCard 
          title="Previous Month Alerts" 
          metrics={metrics.previous} 
          isPrevious={true}
        />
        <MetricsCard 
          title="Present Month Alerts" 
          metrics={metrics.present}
          isPrevious={false}
        />
      </div>
      <div className="flex gap-4">
        <DonutCard 
          title="Open Alerts" 
          data={metrics.present.distribution} 
          metrics={{
            total: metrics.present.total,
            open: metrics.present.open
          }}
          type="open"
        />
        <DonutCard 
          title="Closed Alerts" 
          data={metrics.previous.distribution} 
          metrics={{
            total: metrics.previous.total,
            closed: metrics.previous.closed
          }}
          type="closed"
        />
      </div>
      <DashboardGraph />
    </div>
  );
};

export default Dashboard;