import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '../../../@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../@/components/ui/select";

const EnhancedROsBenchmarkingChart = () => {
 
  const dataMap = {
    '7days': [
      { date: '17th\nDec', platinum: 6000, silver: 4000, gold: 5000, other: 3000 },
      { date: '18th', platinum: 6000, silver: 4000, gold: 5000, other: 3000 },
      { date: '19th', platinum: 6000, silver: 4000, gold: 5000, other: 3000 },
      { date: '20th', platinum: 6000, silver: 4000, gold: 5000, other: 3000 },
      { date: '21st', platinum: 6000, silver: 4000, gold: 5000, other: 3000 },
      { date: '22nd', platinum: 6000, silver: 4000, gold: 5000, other: 3000 },
      { date: '23rd', platinum: 6000, silver: 4000, gold: 5000, other: 3000 }
    ],
    '30days': [
      { date: 'Nov 24', platinum: 5500, silver: 3500, gold: 4500, other: 2500 },
      { date: 'Nov 30', platinum: 5500, silver: 3500, gold: 4500, other: 2500 },
      { date: 'Dec 5', platinum: 5500, silver: 3500, gold: 4500, other: 2500 },
      { date: 'Dec 10', platinum: 5500, silver: 3500, gold: 4500, other: 2500 },
      { date: 'Dec 15', platinum: 5500, silver: 3500, gold: 4500, other: 2500 },
      { date: 'Dec 20', platinum: 5500, silver: 3500, gold: 4500, other: 2500 },
      { date: 'Dec 23', platinum: 5500, silver: 3500, gold: 4500, other: 2500 }
    ],
    '90days': [
      { date: 'Sep 23', platinum: 5000, silver: 3000, gold: 4000, other: 2000 },
      { date: 'Oct 1', platinum: 5000, silver: 3000, gold: 4000, other: 2000 },
      { date: 'Oct 15', platinum: 5000, silver: 3000, gold: 4000, other: 2000 },
      { date: 'Nov 1', platinum: 5000, silver: 3000, gold: 4000, other: 2000 },
      { date: 'Nov 15', platinum: 5000, silver: 3000, gold: 4000, other: 2000 },
      { date: 'Dec 1', platinum: 5000, silver: 3000, gold: 4000, other: 2000 },
      { date: 'Dec 23', platinum: 5000, silver: 3000, gold: 4000, other: 2000 }
    ]
  };

  const [selectedRange, setSelectedRange] = useState('7days');

  // Custom legend component to handle zoom better
  const CustomLegend = ({ payload }) => {
    if (!payload) return null;
    
    return (
      <div className="flex justify-center items-center flex-wrap gap-6 pt-4">
        {payload.map((entry, index) => (
          <div 
            key={index} 
            className="flex items-center gap-2 min-w-[120px] px-2"
          >
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-white text-sm whitespace-nowrap">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Custom tooltip to prevent overlap
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg p-3 shadow-lg">
          <p className="text-white text-sm font-bold mb-2">{label}</p>
          {payload.map((item, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-white">
                {`${item.name}: ${item.value}`}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="w-full max-w-4xl mx-auto shadow-lg bg-[#1a1a2e] border-none">
      <CardHeader className="pb-0">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <CardTitle className="text-base font-semibold text-white">ROs Benchmarking</CardTitle>
            <div className="flex items-center space-x-2">
              <Select 
                defaultValue="7days" 
                onValueChange={(value) => setSelectedRange(value)}
              >
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7days">Last 7 days</SelectItem>
                  <SelectItem value="30days">Last 30 days</SelectItem>
                  <SelectItem value="90days">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={dataMap[selectedRange]}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 40
              }}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                horizontal={true}
                vertical={false}
                stroke="#333333"
              />
              <XAxis 
                dataKey="date"
                tick={{ fontSize: 12, fill: 'white' }}
                axisLine={{ stroke: '#333333' }}
                tickLine={false}
                dy={5}
                height={60}
                interval={0}
              />
              <YAxis 
                tick={{ fontSize: 12, fill: 'white' }}
                axisLine={false}
                tickLine={false}
                domain={[0, 7000]}
                ticks={[0, 1000, 2000, 3000, 4000, 5000, 6000, 7000]}
                width={60}
              />
              <Tooltip content={<CustomTooltip active={undefined} payload={undefined} label={undefined} />} />
              <Legend 
                content={<CustomLegend payload={undefined} />}
                height={36}
              />
              <Line 
                type="monotone" 
                dataKey="platinum" 
                name="Platinum(>99)" 
                stroke="#00FFFF"
                strokeWidth={2}
                dot={false}
              />
              <Line 
                type="monotone" 
                dataKey="gold" 
                name="Gold(95-99)" 
                stroke="#FF7F7F"
                strokeWidth={2}
                dot={false}
              />
              <Line 
                type="monotone" 
                dataKey="silver" 
                name="Silver(85-95)" 
                stroke="#e5af20"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default EnhancedROsBenchmarkingChart;