
import React, { useState, useCallback, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Rectangle, Text, LabelList } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select";
import { Button } from "@/@/components/ui/button";
import { LabelProps, TooltipProps } from 'recharts';
import { fetchChartData, fetchDistinctValues } from './api';
import { IconArrowLeft, IconRestore } from '@tabler/icons-react';

interface ChartData {
  name: string;
  actual: number;
  target: number;
  uniqueId?: string;
}

export const CustomTooltip: React.FC<TooltipProps<number, string>> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return ( 
      <div className="bg-[#2a2a3e] p-4 rounded-lg shadow-lg border border-gray-600">
        <p className="font-bold text-white mb-2 text-sm">{label}</p>
        {payload.map((entry, index) => (
          <p 
            key={index}
            className="text-sm flex justify-between items-center gap-4"
            style={{ color: entry.color }}
          >
            <span>{entry.name}:</span>
            <span className="font-semibold">{entry.value?.toLocaleString()} TMT</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const CustomLabel: React.FC<LabelProps> = ({ x, y, width, height, value }) => {
  if (!value || !width || typeof width === 'string' || width < 40) return null;

  const xPos = (typeof x === 'number' ? x : parseFloat(x || '0')) + width / 2;
  const yPos = (typeof y === 'number' ? y : parseFloat(y || '0')) + (typeof height === 'number' ? height : parseFloat(height || '0')) / 2;
  return (
    <text
      x={xPos}
      y={yPos}
      fill="white"
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={11}
      fontWeight="bold"
    >
      {value.toLocaleString()}
    </text>
  );
};

const Percentage: React.FC<any> = (props) => {
  const { x, y, width, height, value, actual } = props;
  
  let percentage: number;
  let isPositive: boolean;

  if (actual === 0) {
    percentage = value > 0 ? 100 : 0;
    isPositive = value > 0;
  } else {
    percentage = ((value - actual) / actual) * 100;
    isPositive = percentage >= 0;
  }

  const arrowLength = 30;
  
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill="#dea600" />
      
      <line 
        x1={x + width/2}
        y1={y - 5}
        x2={x + width/2}
        y2={y - arrowLength}
        stroke={isPositive ? '#4CAF50' : '#FF5252'}
        strokeWidth={2}
      />
      <polygon
        points={
          isPositive 
            ? `${x + width/2 - 5},${y - arrowLength + 5} ${x + width/2},${y - arrowLength} ${x + width/2 + 5},${y - arrowLength + 5}`
            : `${x + width/2 - 5},${y - 10} ${x + width/2},${y - 5} ${x + width/2 + 5},${y - 10}`
        }
        fill={isPositive ? '#4CAF50' : '#FF5252'}
      />
      <rect
        x={x + width/2 - 25}
        y={y - arrowLength - 20}
        width={50}
        height={20}
        fill="#1a1a2e"
        rx={4}
      />
      <text
        x={x + width/2}
        y={y - arrowLength - 5}
        fill={isPositive ? '#4CAF50' : '#FF5252'}
        textAnchor="middle"
        fontSize="12"
        fontWeight="bold"
      >
        {isPositive ? `+${percentage.toFixed(1)}%` : `${percentage.toFixed(1)}%`}
      </text>
    </g>
  );
};


const CustomXAxisTick: React.FC<any> = ({ x, y, payload }) => {
  const words = payload.value.split(' ');
  const lineHeight = 15;
  return (
    <g transform={`translate(${x},${y})`}>
      {words.map((word: string, index: number) => ( 
        <text
          key={index}
          x={0}
          y={index * lineHeight}
          dy={16}
          textAnchor="middle"
          fill="#fff"
          fontSize={words.length > 9 ? 10 : 12}
        >
          {word}
        </text>
      ))}
    </g>
  );
};

const renderCustomizedLabel = (props) => {
  const { x, y, width, height, value } = props;
  const radius = 10;

  return (
    <g>
      <text className='text-[0.52rem]' x={x + width / 2} y={y - radius} fill="#fff" textAnchor="middle" dominantBaseline="middle">
        {value}
      </text>
    </g>
  );
};

const DrillStateIndicator = ({ drillLevel }) => {
  const states = ['Month', 'SBU', 'Zone', 'Region', 'Sales Area', 'Product'];
  
  return (
    <div className="absolute bottom-3 left-4 bg-[#2a2a3e] rounded-lg p-0 border border-gray-600">
      <div className="flex items-center gap-2 text-xs text-white">
        <span>Current Level:</span>
        <span className="font-bold text-[#00a495]">{states[drillLevel]}</span>
        <div className="flex gap-1 ml-2">
          {states.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full ${
                index === drillLevel ? 'bg-[#00a495]' : 'bg-gray-600'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const SalesGrowthChart: React.FC = () => {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [drillLevel, setDrillLevel] = useState(0);
  const [filters, setFilters] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<'month' | 'year'>('month');
  const [drillHistory, setDrillHistory] = useState<string[]>(mode === 'month' ? [] : []);


  // Filter states
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedSBU, setSelectedSBU] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedSalesArea, setSelectedSalesArea] = useState('');

  // Filter options
  const [yearOptions, setYearOptions] = useState<string[]>([]);
  const [monthOptions, setMonthOptions] = useState<string[]>([]);
  const [sbuOptions, setSbuOptions] = useState<string[]>([]);
  const [zoneOptions, setZoneOptions] = useState<string[]>([]);
  const [regionOptions, setRegionOptions] = useState<string[]>([]);
  const [salesAreaOptions, setSalesAreaOptions] = useState<string[]>([]);

  const getXAxisKey = useCallback(() => {
    const keys = ['month_name', 'SBU_Name', 'Zone_Name', 'ro', 'SalesArea_Name', 'MATERIALGROUPNAME'];
    return keys[drillLevel] || 'MATERIALGROUPNAME';
  }, [drillLevel]);

  const loadData = useCallback(async () => { 
    setIsLoading(true);
    try {
      const response = await fetchChartData({
        filters,
        action: mode === 'month' ? "sales_growth" : "sales_yearly_growth",
        drill_state: ""
      });
      if (response.status && response.data) {
        let transformedData: ChartData[];
        if (drillLevel === 0) {
          if (mode === 'month') {
            transformedData = Object.keys(response.data.fy_month).map((key) => ({
              name: response.data.month_name[key],
              actual: response.data["2023-2024"][key],
              target: response.data["2024-2025"][key],
            }));
          } else {
            transformedData = Object.keys(response.data.fiscal_year).map((key) => ({
              name: response.data.fiscal_year[key],
              actual: response.data["2023-2024"][key],
              target: response.data["2024-2025"][key],
            }));
          }
        } else {
          const xAxisKey = getXAxisKey();
          transformedData = response.data.map((item: any) => ({
            name: item[xAxisKey] || '',
            actual: item["2023-2024"],
            target: item["2024-2025"],
          }));
        }
        setChartData(transformedData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setIsLoading(false);
  }, [filters, drillLevel, mode, getXAxisKey]);

  const loadDistinctValues = useCallback(async (column: string, whereCond: any = {}) => {
    try {
      const response = await fetchDistinctValues({
        connection_id: "1",
        schema: "public",
        table: "M60_LEVEL_METADATA",
        column: [column],
        where_cond: whereCond
      });
      if (response.status && response.data) {
        return response.data[column];
      }
    } catch (error) {
      console.error(`Error fetching distinct values for ${column}:`, error);
    }
    return [];
  }, []);

  useEffect(() => {
    const initializeFilters = async () => {
      const years = await loadDistinctValues(mode === 'year' ? 'fiscal_year' : 'month_name');
      if (mode === 'year') {
        setYearOptions(years);
      } else {
        setMonthOptions(years);
      }
    };
    initializeFilters();
  }, [mode, loadDistinctValues]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBarClick = useCallback((entry: any) => {
    if (drillLevel >= 5) return;
    
    let newFilters = [...filters];
    
    if (mode === 'month' && drillLevel === 0) {
      newFilters = [
        { key: '"month_name"', cond: "equals", value: entry.name }
      ];
    } else {
      const filterKeys = mode === 'month' 
        ? ["month_name", "SBU_Name", "Zone_Name", "ro", "SalesArea_Name"]
        : ["fiscal_year", "SBU_Name", "Zone_Name", "ro", "SalesArea_Name"];
  
      if (mode === 'year' && drillLevel === 0) {
        newFilters.push({
          key: '"fiscal_year"',
          cond: "equals",
          value: entry.name
        });
      } else {
        newFilters.push({
          key: `"${filterKeys[drillLevel]}"`,
          cond: "equals",
          value: entry.name
        });
      }
    }    setFilters(newFilters);
    setDrillLevel(prev => prev + 1);
    setDrillHistory([...drillHistory, entry.name]);
  }, [drillLevel, filters, drillHistory, mode]);

  const handleBackClick = useCallback(() => {
    if (drillLevel > 0) { 
      if (mode === 'month' && drillLevel === 1) { 
        // If in month mode and at SBU level, go back to month graph
        setDrillLevel(0);
        setFilters([]);
        setDrillHistory([]);
      } else {
        // Normal back functionality
        setFilters(filters.slice(0, -1));
        setDrillLevel(drillLevel - 1);
        setDrillHistory(drillHistory.slice(0, -1));
      }
    }
  }, [drillLevel, filters, drillHistory, mode]);

  const resetFilters = useCallback(() => {
    setDrillLevel(0);
    setFilters([]);
    setSelectedYear('');
    setSelectedMonth('');
    setSelectedSBU('');
    setSelectedZone('');
    setSelectedRegion('');
    setSelectedSalesArea('');
    setDrillHistory(mode === 'month' ? [] : []);
  }, []);

  const toggleYearMode = useCallback(() => {
    setMode('year');
    setDrillHistory([]);
    resetFilters();
  }, [resetFilters]);
  const toggleMonthMode = useCallback(() => {
    setMode('month');
    setDrillHistory([]);
    resetFilters();
  }, [resetFilters]);

  const handleYearChange = async (value: string) => {
    if (value === "_empty") {
      resetFilters();
      return;
    }
    setSelectedYear(value);
    setFilters([{ key: '"fiscal_year"', cond: "equals", value }]);
    setDrillLevel(1);
    setDrillHistory([value]);
    const sbus = await loadDistinctValues('SBU_Name', { FISCAL_YEAR: value });
    setSbuOptions(sbus);
  };

  const handleMonthChange = async (value: string) => {
    if (value === "_empty") {
      resetFilters();
      return;
    }
    setSelectedMonth(value);
    setFilters([
      { key: '"month_name"', cond: "equals", value }
    ]);
    setDrillLevel(1);
    setDrillHistory(["FY 2024-2025", value]);
    const sbus = await loadDistinctValues('SBU_Name', { FISCAL_YEAR: "FY 2024-2025", month_name: value });
    setSbuOptions(sbus);
  };

  const handleSBUChange = async (value: string) => {
    if (value === "_empty") {
      setFilters(filters.slice(0, -1));
      setDrillLevel(drillLevel -1);
      setDrillHistory(drillHistory.slice(0,-1));
      setSelectedSBU('');
      return;
    }
    setSelectedSBU(value);
    setFilters([...filters, { key: '"SBU_Name"', cond: "equals", value }]);
    setDrillLevel(2);
    setDrillHistory([...drillHistory, value]);
    const zones = await loadDistinctValues('Zone_Name', { ...filters.reduce((acc, filter) => ({ ...acc, [filter.key.replace(/"/g, '')]: filter.value }), {}), SBU_Name: value });
    setZoneOptions(zones);
  };

  const handleZoneChange = async (value: string) => {
    if (value === "_empty") {
      setFilters(filters.slice(0, -1));
      setDrillLevel(drillLevel - 1);
      setDrillHistory(drillHistory.slice(0, -1));
      setSelectedZone('');
      return;
    }
    setSelectedZone(value);
    setFilters([...filters, { key: '"Zone_Name"', cond: "equals", value }]);
    setDrillLevel(3);
    setDrillHistory([...drillHistory, value]);
    const regions = await loadDistinctValues('ro', { ...filters.reduce((acc, filter) => ({ ...acc, [filter.key.replace(/"/g, '')]: filter.value }), {}), Zone_Name: value });
    setRegionOptions(regions);
  };

  const handleRegionChange = async (value: string) => {
    if (value === "_empty") {
      setFilters(filters.slice(0, -1));
      setDrillLevel(drillLevel - 1);
      setDrillHistory(drillHistory.slice(0, -1));
      setSelectedRegion('');
      return;
    }
    setSelectedRegion(value);
    setFilters([...filters, { key: '"ro"', cond: "equals", value }]);
    setDrillLevel(4);
    setDrillHistory([...drillHistory, value]);
    const salesAreas = await loadDistinctValues('SalesArea_Name', { ...filters.reduce((acc, filter) => ({ ...acc, [filter.key.replace(/"/g, '')]: filter.value }), {}), ro: value });
    setSalesAreaOptions(salesAreas);
  };

  const handleSalesAreaChange = (value: string) => {
    if (value === "_empty") {
      setFilters(filters.slice(0, -1));
      setDrillLevel(drillLevel - 1);
      setDrillHistory(drillHistory.slice(0, -1));
      setSelectedSalesArea('');
      return;
    }
    setSelectedSalesArea(value);
    setFilters([...filters, { key: '"SalesArea_Name"', cond: "equals", value }]);
    setDrillLevel(5);
    setDrillHistory([...drillHistory, value]);
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-[500px] text-white">Loading...</div>;
  }

  return (
    <Card className="w-full bg-[#1a1a2e] rounded-lg border-none  p-0">
      <CardHeader className="p-1">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-bold text-white">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-base">Sales Growth</span>
                {mode === "year" ? (
                  <Select value={selectedYear} onValueChange={handleYearChange}>
                    <SelectTrigger className="w-[100px] bg-[#2a2a3e] text-white border-gray-600">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_empty">All</SelectItem>
                      {yearOptions.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select
                    value={selectedMonth}
                    onValueChange={handleMonthChange}
                  >
                    <SelectTrigger className="w-[100px] bg-[#2a2a3e] text-white border-gray-600">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_empty">All</SelectItem>
                      {monthOptions.map((month) => (
                        <SelectItem key={month} value={month}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={selectedSBU} onValueChange={handleSBUChange}>
                  <SelectTrigger className="w-[100px] bg-[#2a2a3e] text-white border-gray-600">
                    <SelectValue placeholder="SBU" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_empty">All</SelectItem>
                    {sbuOptions.map((sbu) => (
                      <SelectItem key={sbu} value={sbu}>
                        {sbu}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedZone} onValueChange={handleZoneChange}>
                  <SelectTrigger className="w-[100px] bg-[#2a2a3e] text-white border-gray-600">
                    <SelectValue placeholder="Zone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_empty">All</SelectItem>
                    {zoneOptions.map((zone) => (
                      <SelectItem key={zone} value={zone}>
                        {zone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedRegion}
                  onValueChange={handleRegionChange}
                >
                  <SelectTrigger className="w-[100px] bg-[#2a2a3e] text-white border-gray-600">
                    <SelectValue placeholder="Region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_empty">All</SelectItem>
                    {regionOptions.map((region) => (
                      <SelectItem key={region} value={region}>
                        {region}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedSalesArea}
                  onValueChange={handleSalesAreaChange}
                >
                  <SelectTrigger className="w-[100px] bg-[#2a2a3e] text-white border-gray-600">
                    <SelectValue placeholder="Sales Area" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_empty">All</SelectItem>
                    {salesAreaOptions.map((salesArea) => (
                      <SelectItem key={salesArea} value={salesArea}>
                        {salesArea}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardTitle>
            <div className="flex mt-1 gap-1">
              <div className="flex gap-1">
                <Button
                  variant={mode === "month" ? "outline" : "default"}
                  onClick={toggleMonthMode}
                  className="border text-xs p-1 w-6 h-6 flex items-center justify-center"
                >
                  M
                </Button>
                <Button
                  variant={mode === "year" ? "outline" : "default"}
                  onClick={toggleYearMode}
                  className="border text-xs p-1 w-6 h-6 flex items-center justify-center"
                >
                  Y
                </Button>
                {drillLevel > 0 && (
                  <div className="flex mr-2 gap-1">
                    <Button
                      onClick={handleBackClick}
                      className="text-white text-xs font-bold p-1 w-6 h-6 rounded-sm shadow transform transition-transform duration-300 hover:scale-105 bg-slate-500 flex items-center justify-center"
                    >
                      <IconArrowLeft stroke={1.5} />
                    </Button>
                    <Button
                      onClick={resetFilters}
                      className="text-white text-xs font-bold p-1 w-6 h-6 rounded-sm shadow transform transition-transform duration-300 hover:scale-105 bg-slate-500 flex items-center justify-center"
                    >
                      <IconRestore stroke={1.5} />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
          {drillHistory.length > 0 && (
            <div className="text-white text-sm">
              Drill History: {drillHistory.join(" / ")}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[515px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 36 }}
            >
              <XAxis
                dataKey="name"
                tick={<CustomXAxisTick />}
                height={60}
                interval={0}
              />
              <YAxis
                tick={{ fill: "white", fontSize: "0.7rem" }}
                label={{
                  value: "Sales(TMT)",
                  angle: -90,
                  position: "insideLeft",
                  fill: "white",
                  fontSize: 11,
                }}
                axisLine={{ stroke: "white" }}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "#1c1c32" }}
              />
              <Bar
                dataKey="actual"
                name="2023-2024"
                fill="#00a495"
                // activeBar={<Rectangle fill="#00a495" stroke="#00a495" />}
                onClick={handleBarClick}
              >
                <LabelList dataKey="actual" content={renderCustomizedLabel} />

                <CustomLabel />
              </Bar>
              <Bar
                dataKey="target"
                name="2024-2025"
                fill="#dea600"
                // activeBar={<Rectangle fill="#dea600" stroke="#dea600" />}
                onClick={handleBarClick}
                shape={(props) => <Percentage {...props} actual={props.payload.actual} />}

              >
                <LabelList dataKey="target" content={renderCustomizedLabel} />

                <CustomLabel />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <DrillStateIndicator drillLevel={drillLevel} />
          {/* {mode === "month" && (
            <div className="text-center text-white mt-2">FY 2024-2025</div>
          )} */}
        </div>
      </CardContent>
    </Card>
  );
};

export default SalesGrowthChart;


