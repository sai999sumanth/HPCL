import React from 'react';
import { Card, CardContent } from '../../../@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const CircularGauge = ({ title, count, total, color }) => {
  const percentage = (count / total) * 100;
  const strokeWidth = 8;
  const size = 120;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-30 h-30">
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={strokeWidth}
          />
          {/* Foreground circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{count}</span>
          <span className="text-xs text-gray-500">{`${percentage.toFixed(1)}%`}</span>
        </div>
      </div>
      <h3 className="mt-3 text-sm font-medium text-gray-700">{title}</h3>
    </div>
  );
};

const StatusPieChart = ({ statusCounts }) => {
  const data = [
    { name: 'Deployed', value: statusCounts.deployed },
    { name: 'Connected', value: statusCounts.connected },
    { name: 'Disconnected', value: statusCounts.disconnected },
    { name: 'Issues', value: statusCounts.issues },
  ];

  const COLORS = ['#3B82F6', '#10B981', '#EF4444', '#F59E0B'];

  return (
    <div className="flex-1 mt-2"> 
    <h3 className="text-lg font-bold text-blue-600 text-center mb-2">
      Status Distribution
    </h3>
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" outerRadius="80%" fill="#8884d8">
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  </div>
  
  );
};

const StatusDashboard = () => {
 const statusCounts = {
   deployed: 75,
   connected: 68,
   disconnected: 7,
   total: 150,
   issues: 10,
 };

 return (
   <Card className="w-full h-[300px] bg-white">
     <CardContent className="p-4 flex gap-8 items-center">
       {/* Circular Gauges Section */}
       <div className="grid grid-cols-5 gap-8 flex-1">
         <CircularGauge title="Total" count={statusCounts.total} total={statusCounts.total} color="#6366F1" />
         <CircularGauge title="Deployed" count={statusCounts.deployed} total={statusCounts.total} color="#3B82F6" />
         <CircularGauge title="Connected" count={statusCounts.connected} total={statusCounts.total} color="#10B981" />
         <CircularGauge title="Disconnected" count={statusCounts.disconnected} total={statusCounts.total} color="#EF4444" />
         <CircularGauge title="Issues" count={statusCounts.issues} total={statusCounts.total} color="#F59E0B" />
       </div>
       
       {/* Pie Chart Section */}
       <div className="flex-1 max-w-[400px]">
         <StatusPieChart statusCounts={statusCounts} />
       </div>
     </CardContent>
   </Card>
 );
};

export default StatusDashboard;