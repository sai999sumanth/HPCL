import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Terminal, AlertTriangle, ArrowUp, ArrowDown, Clock } from 'lucide-react';

const DashboardCards = () => {
  const terminalData = [
    { region: 'Terminal A', terminals: 850, growth: 12 },
    { region: 'Terminal B', terminals: 720, growth: 8 },
    { region: 'Terminal C', terminals: 680, growth: 15 },
    { region: 'Terminal D', terminals: 590, growth: 6 },
    { region: 'Terminal E', terminals: 460, growth: 10 }
  ];

  const alertData = [
    { name: 'Critical', value: 30, color: '#FF416C', change: 5, responseTime: '5 min' },
    { name: 'High', value: 45, color: '#FF4B2B', change: -2, responseTime: '15 min' },
    { name: 'Medium', value: 85, color: '#FFA62E', change: 8, responseTime: '30 min' },
    { name: 'Low', value: 140, color: '#38EF7D', change: -3, responseTime: '60 min' }
  ];

  const totalTerminals = terminalData.reduce((sum, item) => sum + item.terminals, 0);
  const totalAlerts = alertData.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 rounded-lg shadow-md border border-gray-200">
          <p className="font-semibold">{label}</p>
          <p className="text-blue-600">Terminals: {payload[0].value}</p>
          <p className="text-green-600">Growth: {terminalData.find(item => item.region === label).growth}%</p>
        </div>
      );
    }
    return null;
  };

  return ( 
    <div className="w-full p-1 space-y-4 bg-gray-50">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {/* Terminal Card */}
        <Card className="bg-white/70 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-blue-600">
                  Number of Terminals
                </CardTitle>
                <p className="text-xs text-gray-500">Regional Distribution</p>
              </div>
              <div className="p-2 bg-blue-500 rounded-lg">
                <Terminal className="h-4 w-4 text-white" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="p-2 rounded-lg bg-blue-50">
                <p className="text-xs text-gray-600">Total</p>
                <p className="text-lg font-bold text-blue-600">{totalTerminals.toLocaleString()}</p>
              </div>
              <div className="p-2 rounded-lg bg-green-50">
                <p className="text-xs text-gray-600">Avg Growth</p>
                <p className="text-lg font-bold text-green-600">
                  {(terminalData.reduce((sum, item) => sum + item.growth, 0) / terminalData.length).toFixed(1)}%
                </p>
              </div>
            </div>
            
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={terminalData} barSize={20}>
                  <XAxis dataKey="region" stroke="#6B7280" fontSize={12} />
                  <YAxis stroke="#6B7280" fontSize={12} />
                  <Tooltip content={<CustomTooltip active={undefined} payload={undefined} label={undefined} />} />
                  <Bar dataKey="terminals" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Alert Distribution Card */}
        <Card className="bg-white/90 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-orange-600">
                  Alert Distribution
                </CardTitle>
                <p className="text-sm text-gray-500">Severity Overview</p>
              </div>
              <div className="p-2 bg-orange-500 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-white" />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {/* Left side - Chart and Total */}
              <div className="space-y-2">
                <div className="p-3 bg-orange-50 rounded-lg">
                  <p className="text-xs text-gray-600">Total Alerts</p>
                  <p className="text-xl font-bold text-orange-600">{totalAlerts}</p>
                  <p className="text-xs text-gray-500 mt-1">Last 24 hours</p>
                </div>
                
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={alertData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={3}
                        dataKey="value"
                        startAngle={90}
                        endAngle={450}
                      >
                        {alertData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Right side - Detailed Information */}
              <div className="space-y-2">
                {alertData.map((alert) => (
                  <div
                    key={alert.name}
                    className="p-2 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: alert.color }} />
                        <span className="font-medium text-sm text-gray-700">{alert.name}</span>
                      </div>
                      <span className="text-sm font-bold">{alert.value}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div className="flex items-center text-xs text-gray-600">
                        <Clock className="h-3 w-3 mr-1" />
                        {alert.responseTime}
                      </div>
                      <div className="flex items-center justify-end text-xs">
                        {alert.change > 0 ? (
                          <div className="flex items-center text-green-600">
                            <ArrowUp className="h-3 w-3 mr-1" />
                            {alert.change}%
                          </div>
                        ) : (
                          <div className="flex items-center text-red-600">
                            <ArrowDown className="h-3 w-3 mr-1" />
                            {Math.abs(alert.change)}%
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardCards;