import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '../../../@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../@/components/ui/select';

const PerformanceDashboard = () => {
  const [pivotBy, setPivotBy] = useState('task');
  
  // Updated data and colors to match the image exactly
  const contractData = [
    { name: 'Segment 1', value: 33, color: '#1e3a8a' },  // Darkest blue
    { name: 'Segment 2', value: 33, color: '#3b82f6' },  // Medium blue
    { name: 'Segment 3', value: 34, color: '#93c5fd' }   // Light blue
  ];

  const openHoursData = [
    { name: 'Peak Hours', value: 45, color: '#60a5fa' },    // Medium-light blue
    { name: 'Off Hours', value: 55, color: '#bfdbfe' }      // Lightest blue
  ];

  // Rest of the taskData and pivot functionality remains the same
  const taskData = [
    { task: 'Task 1', step: 'Step 1', status: 'low', count: 5 },
    { task: 'Task 1', step: 'Step 2', status: 'medium', count: 8 },
    { task: 'Task 1', step: 'Step 3', status: 'high', count: 12 },
    { task: 'Task 2', step: 'Step 1', status: 'high', count: 15 },
    { task: 'Task 2', step: 'Step 2', status: 'high', count: 10 },
    { task: 'Task 2', step: 'Step 3', status: 'medium', count: 7 },
    { task: 'Task 3', step: 'Step 1', status: 'medium', count: 9 },
    { task: 'Task 3', step: 'Step 2', status: 'low', count: 4 },
    { task: 'Task 3', step: 'Step 3', status: 'high', count: 11 }
  ];

  const pivotData = () => {
    const result = {};
    const steps = [...new Set(taskData.map(d => d.step))];
    
    taskData.forEach(item => {
      const key = item[pivotBy];
      if (!result[key]) {
        result[key] = { [pivotBy]: key };
        steps.forEach(step => {
          result[key][step] = { status: 'none', count: 0 };
        });
      }
      result[key][item.step] = { status: item.status, count: item.count };
    });
    
    return Object.values(result);
  };

  const getStatusColor = (status) => {
    const colors = {
      low: '#bfdbfe',
      medium: '#3b82f6',
      high: '#1e3a8a',
      none: '#ffffff'
    };
    return colors[status] || '#ffffff';
  };

  const getTextColor = (status) => {
    return status === 'high' ? 'text-white' : 'text-gray-900';
  };

  return (
    <div className="w-full max-w-6xl mx-auto bg-[#1a1a2e]">
      <Card className=" shadow-lg  bg-[#1a1a2e] text-white border-0" >
        <CardHeader className="border-b">
          <CardTitle className="text-2xl font-bold">Performance Overviewsss</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <Tabs defaultValue="charts">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="charts">Charts Overview</TabsTrigger>
              <TabsTrigger value="pivot">Pivot Analysis</TabsTrigger>
            </TabsList>

            <TabsContent value="charts" className="mt-0">
              <div className="grid grid-cols-2 gap-6">
                <Card className="shadow-sm bg-[#1a1a2e] text-white border-0">
                  <CardHeader>
                    <CardTitle className="text-lg">Contract Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={contractData}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            dataKey="value"
                          >
                            {contractData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Legend 
                            layout="horizontal"
                            align="center"
                            verticalAlign="bottom"
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm bg-[#1a1a2e] text-white border-0">
                  <CardHeader>
                    <CardTitle className="text-lg">Open Hours</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={openHoursData}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            dataKey="value"
                          >
                            {openHoursData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Legend 
                            layout="horizontal"
                            align="center"
                            verticalAlign="bottom"
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent >

            <TabsContent value="pivot" className="mt-0 bg-[#1a1a2e]">
              {/* Pivot table content remains the same */}
              <Card className="shadow-sm bg-[#1a1a2e] text-white">
                <CardHeader className="pb-4">
                  <div className="flex items-center space-x-4">
                    <span className="text-sm font-medium">Pivot By:</span>
                    <Select value={pivotBy} onValueChange={setPivotBy}>
                      <SelectTrigger className="w-[200px] bg-[black]">
                        <SelectValue placeholder="Select dimension" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="task">Task</SelectItem>
                        <SelectItem value="step">Step</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                              {pivotBy === 'task' ? 'Task' : 'Step'}
                            </th>
                            {[...new Set(taskData.map(d => pivotBy === 'task' ? d.step : d.task))].map(header => (
                              <th key={header} className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pivotData().map((row, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="px-4 py-3 text-sm font-medium text-white-900">
                                {row[pivotBy]}
                              </td>
                              {Object.entries(row)
                                .filter(([key]) => key !== pivotBy)
                                .map(([key, value], cellIdx) => (
                                  <td
                                    key={cellIdx}
                                    className={`px-4 py-3 text-sm ${getTextColor(value.status)}`}
                                    style={{ backgroundColor: getStatusColor(value.status) }}
                                  >
                                    {value.status !== 'none' && (
                                      <>
                                        <span className="font-medium">{value.status}</span>
                                        <span className="ml-2">({value.count})</span>
                                      </>
                                    )}
                                  </td>
                                ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default PerformanceDashboard;