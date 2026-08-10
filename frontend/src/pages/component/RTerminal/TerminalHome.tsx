import React, { PureComponent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../../../@/components/ui/card";
import { Button } from "../../../@/components/ui/button";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,  Cell} from 'recharts';
import terminalIcon from '../../../assets/images/oil-barrel.png';

interface CustomizedLabelProps {
  x: number;
  y: number;
  value: number | string;
}

interface CustomizedAxisTickProps {
  x: number;
  y: number;
  payload: {
    value: string;
  };
}

const CustomizedAxisTick = ({ x, y, payload }: CustomizedAxisTickProps) => {
  const maxCharsPerLine = 8;
  const words = payload.value.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  // Break text into lines
  words.forEach(word => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  });
  if (currentLine) {
    lines.push(currentLine);
  }

  return (
    <g transform={`translate(${x},${y})`}>
      {lines.map((line, index) => (
        <text
          key={index}
          x={0}
          y={index * 12}  // line height of 12px
          dy={7}
          textAnchor="middle"
          fill="#666"
          fontSize={10}
        >
          {line}
        </text>
      ))}
    </g>
  );
};



const TerminalHome = () => {

  const colors = ['#1e3a8a', '#1d4ed8', '#3b82f6', '#b1d4ff'];

  // Alert Priority Data

  const alertPriorityData = {
    critical: 67,
    high: 2631,
    low: 22
  };
  
  // Operability Index Data
  const operabilityData = [
    { name: 'Oct 1', value: 99 },
    { name: 'Oct 10', value: 98 },
    { name: 'Oct 20', value: 97 },
    { name: 'Oct 30', value: 99 }
  ];

  // Alert Aging Data
  const alertAgingData = [
    { name: 'Days >20', value: 440 },
    { name: '15-20', value: 118 },
    { name: '5-15', value: 125 },
    { name: '0-5', value: 1833 }
  ];

  // TAS Alerts Data
  const tasAlertsData = [
    { name: 'Supplemental Reports', value: 58 },
    { name: 'Critical Reports', value: 110 },
    { name: 'Process Reports', value: 22 },
    { name: 'QC', value: 2 },
    { name: 'Others', value: 18 }
  ];

  // Non-TAS Alerts Data
  
  const nonTasAlertsData = [
    { name: 'VTS', value: 1769 },
    { name: 'EM Locks', value: 6 },
    { name: 'CCTV', value: 43 },
    { name: 'VTS Exception', value: 492 }
  ];

  // VTS Deviation Data
  const vtsDeviationData = [
    { name: 'Route Break', value: 2 },
    { name: 'Speed Limit', value: 7 },
    { name: 'Location Break', value: 1 },
    { name: 'Time Break', value: 2 },
    { name: 'No VTS', value: 15 },
    { name: 'No Entry', value: 4 },
    { name: 'LPA', value: 6 },
    { name: 'VTS Exception', value: 58 }
  ];

  const timeRangeButtons = ['1', '3', '6', '9', '12'];

  return ( 
    <div className="p-6 space-y-6 bg-slate-100" >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2" >
        {/* Retail Terminal Card */}
     <Card>
      <CardHeader>
        <CardTitle>Retail Terminal</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center space-y-6">
          {/* Center image */}
          <div className="w-32 h-32 flex items-center justify-center" >
            <img 
              src={terminalIcon}
              alt="Retail Terminal"
              className="object-contain"
            />
          </div>
          {/* Alert Priority Header */}
          {/* Alert Types */}
          <div className="w-full space-y-1">
          <h3 className="text-sm font-medium">Alert Priority</h3>       
            <div className="flex items-center justify-between">
              <span className="text-red-500 font-medium">Critical</span>
              <span>{alertPriorityData.critical}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-yellow-500 font-medium">High</span>
              <span>{alertPriorityData.high}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-500 font-medium">Low</span>
              <span>{alertPriorityData.low}</span>
            </div>
          </div>
        </div>
      </CardContent>
     </Card>

        {/* Operability Index Card */}

        <Card>
      <CardHeader>
      <CardTitle>
              Avg. Operability Index
            </CardTitle>
            <div className="flex gap-1 justify-end">
              Months
                {timeRangeButtons.map((month) => (
                  <Button
                    key={month}
                    variant="outline"
                    size="sm"
                    className="h-8 w-8"
                  >
                    {month}
                  </Button>
                ))}
              </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={operabilityData}>
            <defs>
              <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#04C6F6" stopOpacity={1} />
    <stop offset="55%" stopColor="#04C6F6" stopOpacity={0.9} />
    <stop offset="75%" stopColor="#20a4ff" stopOpacity={0.8} />
    <stop offset="100%" stopColor="#0684D0" stopOpacity={1} />
              </linearGradient>
            </defs>
            {/* Removed CartesianGrid completely */}
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false}
              tick={{ fill: '#666', fontSize: 12 }}
            />
            <YAxis 
              domain={[0, 100]} 
              axisLine={false} 
              tickLine={false}
              tick={{ fill: '#666', fontSize: 12 }}
            />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#1e40af"
              fill="url(#colorGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>


        {/* Alert Aging Card */}
        <Card>
      <CardHeader>
        <CardTitle className="flex justify-between">
          <span>Alert Aging</span>
          <span className="text-base font-bold">2514</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart 
            data={alertAgingData}
            margin={{
              top: 20,
              right: 20,
              left: 20,
              bottom: 20,
            }}
          >
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false}
              tick={{ fill: '#666', fontSize: 12 }}
            />
            <Tooltip 
            />
            <Bar
              dataKey="value"
              radius={[10, 10, 0, 0]}
              label={{ 
                position: 'top',
                fill: '#666',
              }}
            >
              {
                alertAgingData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index]} />
                ))
              }
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>

        <Card>
      <CardHeader>
        <CardTitle className="flex justify-between">
          <span>TAS Alerts</span>
          <span className="text-base font-bold">210</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="110%" height={270}>
          <BarChart 
            data={tasAlertsData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 40,
            }}
          >
            <XAxis 
              dataKey="name" 
              height={60} 
              axisLine={false}
              tickLine={false}
              interval={0}
              tick={CustomizedAxisTick}
              />
            <Tooltip />
            <Bar 
              dataKey="value" 
              fill="#2563eb" 
              radius={[3, 3, 0, 0]}
              label={{ position: 'top' }}
              />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>

        {/* Non-TAS Alerts Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between">
              <span>Non TAS Alerts</span>
              <span className="text-base font-bold">2304</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
          <ResponsiveContainer width="110%" height={270}>
          <BarChart 
            data={nonTasAlertsData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 40,
            }}
          >
            <XAxis 
              dataKey="name" 
              height={60} 
              axisLine={false}
              tickLine={false}
              interval={0}
              tick={CustomizedAxisTick}
              />
            <Tooltip />
            <Bar 
              dataKey="value" 
              fill="#2563eb" 
              radius={[3, 3, 0, 0]}
              label={{ position: 'top' }}
              />
          </BarChart>
        </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* VTS Deviation Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between">
              <span>VTS Deviation Lorry Blocked</span>
              <span className="text-base font-bold">1384</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
          <ResponsiveContainer width="110%" height={270}>
          <BarChart 
            data={vtsDeviationData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 40,
            }}
          >
            <XAxis 
              dataKey="name" 
              height={60} 
              axisLine={false}
              tickLine={false}
              interval={0}
              tick={CustomizedAxisTick}
              />             
            <Tooltip />
            <Bar 
              dataKey="value" 
              fill="#2563eb" 
              radius={[3, 3, 0, 0]}
              label={{ position: 'top' }}
              />
          </BarChart>
        </ResponsiveContainer>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default TerminalHome;