import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../../../@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Badge } from "../../../@/components/ui/badge";
import { AlertTriangle, TrendingUp, Clock, ArrowUpRight, Activity, Shield, AlertCircle } from 'lucide-react';

const AlertDashboardCards = () => {
  const locationData = [
    { location: "Terminal A", alerts: 245, trend: "+12%", responseTime: "2.5m", critical: 45, resolved: 200 },
    { location: "Terminal B", alerts: 198, trend: "+8%", responseTime: "3.1m", critical: 38, resolved: 160 },
    { location: "Terminal C", alerts: 176, trend: "+15%", responseTime: "2.8m", critical: 32, resolved: 144 },
    { location: "Terminal D", alerts: 156, trend: "+5%", responseTime: "2.2m", critical: 28, resolved: 128 },
    { location: "Terminal E", alerts: 134, trend: "+7%", responseTime: "2.9m", critical: 25, resolved: 109 },
    { location: "Terminal F", alerts: 123, trend: "+3%", responseTime: "3.0m", critical: 22, resolved: 101 },
    { location: "Terminal G", alerts: 112, trend: "+9%", responseTime: "2.7m", critical: 20, resolved: 92 },
    { location: "Terminal H", alerts: 98, trend: "+4%", responseTime: "2.4m", critical: 18, resolved: 80 },
    { location: "Terminal I", alerts: 87, trend: "+6%", responseTime: "2.6m", critical: 15, resolved: 72 },
    { location: "Terminal J", alerts: 76, trend: "+2%", responseTime: "2.3m", critical: 12, resolved: 64 }
  ];

  const alertCategoryData = [
    { name: "VTS Violations", value: 1769, color: "#3b82f6", change: "+15%", avgResponse: "2.1m" },
    { name: "Security Breaches", value: 892, color: "#60a5fa", change: "+8%", avgResponse: "1.8m" },
    { name: "Equipment Failures", value: 654, color: "#93c5fd", change: "+12%", avgResponse: "3.2m" },
    { name: "Process Delays", value: 432, color: "#bfdbfe", change: "+5%", avgResponse: "2.7m" },
    { name: "Safety Incidents", value: 321, color: "#dbeafe", change: "+9%", avgResponse: "1.5m" }
  ];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border rounded shadow-lg">
          <p className="text-xs font-semibold">{payload[0].name}</p>
          <p className="text-xs">{`${payload[0].value} Alerts`}</p>
          {payload[0].payload.responseTime && (
            <p className="text-xs">Response: {payload[0].payload.responseTime}</p>
          )}
          {payload[0].payload.critical && (
            <p className="text-xs">Critical: {payload[0].payload.critical}</p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
      <Card className="w-full">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">High Alert Locations</CardTitle>

            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                85% Resolved
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={locationData} margin={{ top: 5, right: 5, left: 0, bottom: 20 }} barSize={16}>
              <defs>
                <linearGradient id="alertGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                  <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <XAxis dataKey="location" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip active={undefined} payload={undefined} />} />
              <Bar dataKey="alerts" fill="url(#alertGradient)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-3 gap-1 mt-1">
            {locationData.slice(0, 3).map((location, index) => ( 
              <div key={location.location} className="p-1 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
                <div className="flex items-center gap-1">
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-xs">
                    {index + 1}
                  </span>
                  <div className="text-xs leading-tight">
                    <div className="font-medium truncate">{location.location}</div>
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                      <span>{location.alerts}</span>
                      <span className="text-green-600 ml-1">{location.trend}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Alert Categories</CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Activity className="h-3 w-3" />
                <span>Total: {alertCategoryData.reduce((sum, item) => sum + item.value, 0)}</span>
                <Shield className="h-3 w-3 ml-2" />
                <span>Security: {alertCategoryData[1].value}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={alertCategoryData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={60}
                paddingAngle={2}
                dataKey="value"
              >
                {alertCategoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip active={undefined} payload={undefined} />} />
              <Legend 
                layout="vertical" 
                align="right"
                verticalAlign="middle"
                iconSize={8}
                iconType="circle"
                formatter={(value, entry) => (
                  <span className="text-xs">
                    {value} ({entry.payload.value})
                  </span>
                )}
                wrapperStyle={{
                  fontSize: '10px',
                  paddingLeft: '10px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-2 gap-1"> 
            <div className="p-2 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-blue-600" />
                <div className="text-xs leading-tight">
                  <p className="font-medium">Response Time</p>
                  <div className="flex items-center">
                    <p className="text-blue-600 font-bold">2.3m Avg</p>
                    <ArrowUpRight className="h-3 w-3 text-green-600 ml-1" />
                    <span className="text-green-600 text-xs">+5%</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-blue-600" />
                <div className="text-xs leading-tight">
                  <p className="font-medium">Resolution Rate</p>
                  <div className="flex items-center">
                    <p className="text-blue-600 font-bold">89%</p>
                    <ArrowUpRight className="h-3 w-3 text-green-600 ml-1" />
                    <span className="text-green-600 text-xs">+3%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Critical Alert Locations</CardTitle>

            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                85% Resolved
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={locationData} margin={{ top: 5, right: 5, left: 0, bottom: 20 }} barSize={16}>
              <defs>
                <linearGradient id="alertGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                  <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <XAxis dataKey="location" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip active={undefined} payload={undefined} />} />
              <Bar dataKey="alerts" fill="url(#alertGradient)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-3 gap-1 mt-1">
            {locationData.slice(0, 3).map((location, index) => (
              <div key={location.location} className="p-1 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
                <div className="flex items-center gap-1">
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-xs">
                    {index + 1}
                  </span>
                  <div className="text-xs leading-tight">
                    <div className="font-medium truncate">{location.location}</div>
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                      <span>{location.alerts}</span>
                      <span className="text-green-600 ml-1">{location.trend}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AlertDashboardCards;