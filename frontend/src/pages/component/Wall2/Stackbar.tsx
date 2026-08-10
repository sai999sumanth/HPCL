import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "../../../@/components/ui/card";

const AdvancedStackedBarChart = () => {
  const data = [
    {'zone': 'NWZ', 'cs_rejection': 0.03, 'gd_rejection': 0.05, 'pt_rejection': 0.1},
    {'zone': 'NZ', 'cs_rejection': 0.04, 'gd_rejection': 0.04, 'pt_rejection': 0.08},
    {'zone': 'EZ', 'cs_rejection': 0.0, 'gd_rejection': 0.04, 'pt_rejection': 0.0},
    {'zone': 'SCZ', 'cs_rejection': 0.06, 'gd_rejection': 0.04, 'pt_rejection': 0.09},
    {'zone': 'WZ', 'cs_rejection': 0.04, 'gd_rejection': 0.04, 'pt_rejection': 0.08},
    {'zone': 'SZ', 'cs_rejection': 0.05, 'gd_rejection': 0.0, 'pt_rejection': 0.0},
    {'zone': 'NCZ', 'cs_rejection': 0.0, 'gd_rejection': 0.0, 'pt_rejection': 0.09}
  ];

  const [activeBar, setActiveBar] = useState(null);

  // Updated colors to match the reference image
  const colors = {
    cs_rejection: '#69c0ff',  // Light blue
    gd_rejection: '#2f54eb',  // Dark blue
    pt_rejection: '#722ed1'   // Purple
  };

  // Custom names for the legend
  const legendNames = {
    cs_rejection: 'CS Rejection',
    gd_rejection: 'GD Rejection',
    pt_rejection: 'PT Rejection'
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-bold text-gray-800">{label}</p>
          {payload.map((entry, index) => (
            <p
              key={index}
              className="text-sm"
              style={{ color: entry.color }}
            >
              {`${entry.name}: ${(entry.value * 100).toFixed(1)}%`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const handleMouseEnter = (data, index) => {
    setActiveBar(index);
  };

  const handleMouseLeave = () => {
    setActiveBar(null);
  };

  // Custom label component for the bars
  const CustomLabel = (props) => {
    const { x, y, width, height, value } = props;
    const labelValue = (value * 100).toFixed(1);
    
    // Only show label if value is greater than 0
    if (value <= 0) return null;

    return (
      <text
        x={x + width / 2}
        y={y + height / 2}
        fill="white"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={12}
      >
        {labelValue}
      </text>
    );
  };

  return (
    <Card className="w-full bg-[#1a1a2e] border border-0">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-white">
          Zone-wise Rejection Rates
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80  w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis 
                dataKey="zone"
                tick={{ fill: 'white' }}
                axisLine={{ stroke: 'white' }}
              />
              <YAxis 
                tick={{ fill: 'white' }}
                axisLine={{ stroke: 'white' }}
                tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
              />
              <Tooltip content={<CustomTooltip active={undefined} payload={undefined} label={undefined} />} />
              {Object.keys(colors).map((key) => (
                <Bar
                  key={key}
                  dataKey={key}
                  name={legendNames[key]}
                  stackId="a"
                  fill={colors[key]}
                  onMouseEnter={(data, index) => handleMouseEnter(data, index)}
                  onMouseLeave={handleMouseLeave}
                  opacity={activeBar === null ? 1 : 0.6}
                >
                  <LabelList
                    dataKey={key}
                    content={<CustomLabel />}
                    position="center"
                  />
                  {data.map((entry, index) => (
                    <g key={index}>
                      <rect
                        opacity={activeBar === index ? 1 : undefined}
                        className="transition-opacity duration-300"
                      />
                    </g>
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdvancedStackedBarChart;