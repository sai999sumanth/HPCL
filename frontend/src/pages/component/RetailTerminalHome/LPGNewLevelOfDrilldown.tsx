import React, { useState, useCallback, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Rectangle, Text, LabelList } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select";
import { Button } from "@/@/components/ui/button";
import { LabelProps, TooltipProps } from 'recharts';
import { IconArrowLeft, IconRestore } from '@tabler/icons-react';
import { fetchChartData, fetchDistinctValues } from '../Wall2/api';
import { Checkbox } from '@/@/components/ui/checkboxdarktheme';

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

const SalesChart: React.FC = () => {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [drillLevel, setDrillLevel] = useState(0);
  const [filters, setFilters] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<'month' | 'year'>('month');
  const [drillHistory, setDrillHistory] = useState<string[]>(mode === 'month' ? ["FY 2024-2025"] : []);

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

  const [isBCChecked, setIsBCChecked] = useState(false);
  const [isRCChecked, setIsRCChecked] = useState(false);
  const [isBC1Checked, setIsBC1Checked] = useState(false);
  const [isRC1Checked, setIsRC1Checked] = useState(false);


  // New state for tracking checkbox selection order
  const [selectedCheckboxes, setSelectedCheckboxes] = useState<Set<string>>(new Set());
  const CHECKBOX_ORDER = ['BC', 'RC', 'BC1', 'RC1'];

  // Modified checkbox handlers with order tracking
  const handleCheckboxChange = (checkboxName: string, checked: boolean) => {
    setSelectedCheckboxes(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(checkboxName);
      } else {
        newSet.delete(checkboxName);
      }
      
      // Get the ordered list of selected checkboxes
      const orderedSelections = CHECKBOX_ORDER.filter(name => newSet.has(name));
      console.log('Selected checkboxes in order:', orderedSelections.join(', '));
      
      return newSet;
    });

    // Update individual checkbox states
    switch (checkboxName) {
      case 'BC':
        setIsBCChecked(checked);
        break;
      case 'RC':
        setIsRCChecked(checked);
        break;
      case 'BC1':
        setIsBC1Checked(checked);
        break;
      case 'RC1':
        setIsRC1Checked(checked);
        break;
    }
  };

  const getXAxisKey = useCallback(() => {
    const keys = ['month_name', 'SBU_Name', 'Zone_Name', 'Region_Name', 'SalesArea_Name', 'ProductName'];
    return keys[drillLevel] || 'ProductName';
  }, [drillLevel]);

  const loadData = useCallback(async () => { 
    setIsLoading(true);
    try {
      const response = await fetchChartData({
        filters,
        action: mode === 'month' ? "sales_performance" : "sales_yearly_performance",
        drill_state: ""
      });
      if (response.status && response.data) {
        let transformedData: ChartData[];
        if (drillLevel === 0) {
          if (mode === 'month') {
            transformedData = Object.keys(response.data.fy_month).map((key) => ({
              name: response.data.month_name[key],
              actual: response.data.ACTUAL_TMT_SALES[key],
              target: response.data.TARGET_TMT_SALES[key],
            }));
          } else {
            transformedData = Object.keys(response.data.FISCAL_YEAR).map((key) => ({
              name: response.data.FISCAL_YEAR[key],
              actual: response.data.ACTUAL_TMT_SALES[key],
              target: response.data.TARGET_TMT_SALES[key],
            }));
          }
        } else {
          const xAxisKey = getXAxisKey();
          transformedData = response.data.map((item: any) => ({
            name: item[xAxisKey] || '',
            actual: item.NETWEIGHT_TMT,
            target: item.TARGET_QTY_TMT,
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
      const years = await loadDistinctValues(mode === 'year' ? 'FISCAL_YEAR' : 'month_name');
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
        { key: '"FISCAL_YEAR"', cond: "equals", value: "FY 2024-2025" },
        { key: '"month_name"', cond: "equals", value: entry.name }
      ];
    } else {
      const filterKeys = mode === 'month' 
        ? ["FISCAL_YEAR", "month_name", "SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name"]
        : ["FISCAL_YEAR", "SBU_Name", "Zone_Name", "Region_Name", "SalesArea_Name"];
    
      if (mode === 'year' && drillLevel === 0) {
        newFilters.push({
          key: '"FISCAL_YEAR"',
          cond: "equals",
          value: entry.name
        });
      } else {
        newFilters.push({
          key: `"${filterKeys[drillLevel + (mode === 'year' ? 0 : 1)]}"`,
          cond: "equals",
          value: entry.name
        });
      }
    }
    setFilters(newFilters);
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
    setDrillHistory(mode === 'month' ? ['FY 2024-2025'] : []);
  }, []);

  const toggleYearMode = useCallback(() => {
    setMode('year');
    setDrillHistory([]);
    resetFilters();
  }, [resetFilters]);
  const toggleMonthMode = useCallback(() => {
    setMode('month');
    setDrillHistory(["FY 2024-25"]);
    resetFilters();
  }, [resetFilters]);

  const handleYearChange = async (value: string) => {
    if (value === "_empty") {
      resetFilters();
      return;
    }
    setSelectedYear(value);
    setFilters([{ key: '"FISCAL_YEAR"', cond: "equals", value }]);
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
      { key: '"FISCAL_YEAR"', cond: "equals", value: "FY 2024-2025" },
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
    const regions = await loadDistinctValues('Region_Name', { ...filters.reduce((acc, filter) => ({ ...acc, [filter.key.replace(/"/g, '')]: filter.value }), {}), Zone_Name: value });
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
    setFilters([...filters, { key: '"Region_Name"', cond: "equals", value }]);
    setDrillLevel(4);
    setDrillHistory([...drillHistory, value]);
    const salesAreas = await loadDistinctValues('SalesArea_Name', { ...filters.reduce((acc, filter) => ({ ...acc, [filter.key.replace(/"/g, '')]: filter.value }), {}), Region_Name: value });
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
    <Card className="w-full bg-[#1a1a2e] rounded-lg border-none p-0">
      <CardHeader className="p-1">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-bold text-white">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-base">Actual vs Target M60</span>
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

                    
                  <Select value={selectedMonth} onValueChange={handleMonthChange}>
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
                 {/* Add checkboxes here */}
                              <div className="flex items-center gap-4 ml-2">
                                  <div className="flex items-center gap-2">
                                      <Checkbox
                                          id="bc"
                                          checked={isBCChecked}
                                          onCheckedChange={(checked) => handleCheckboxChange('BC', !!checked)}
                                          className="bg-[#2a2a3e] border-gray-600"
                                      />
                                      <label htmlFor="bc" className="text-sm text-white cursor-pointer">
                                          BC
                                      </label>
                                  </div>
                                  <div className="flex items-center gap-2">
                                      <Checkbox
                                          id="rc"
                                          checked={isRCChecked}
                                          onCheckedChange={(checked) => handleCheckboxChange('RC', !!checked)}
                                          className="bg-[#2a2a3e] border-gray-600"
                                      />
                                      <label htmlFor="rc" className="text-sm text-white cursor-pointer">
                                          RC
                                      </label>
                                  </div>
                              </div>
                              <div className="flex items-center gap-4 ml-2">
                                  <div className="flex items-center gap-2">
                                      <Checkbox
                                          id="bc1"
                                          checked={isBC1Checked}
                                          onCheckedChange={(checked) => handleCheckboxChange('BC1', !!checked)}
                                          className="bg-[#2a2a3e] border-gray-600"
                                      />
                                      <label htmlFor="bc1" className="text-sm text-white cursor-pointer">
                                          BC1
                                      </label>
                                  </div>
                                  <div className="flex items-center gap-2">
                                      <Checkbox
                                          id="rc1"
                                          checked={isRC1Checked}
                                          onCheckedChange={(checked) => handleCheckboxChange('RC1', !!checked)}
                                          className="bg-[#2a2a3e] border-gray-600"
                                      />
                                      <label htmlFor="rc1" className="text-sm text-white cursor-pointer">
                                          RC1
                                      </label>
                                  </div>
                              </div>

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
                name="Actual TMT Sales"
                fill="#00a495"
                // activeBar={<Rectangle fill="#00a495" stroke="#00a495" />}
                onClick={handleBarClick}
              >
                <LabelList dataKey="actual" content={renderCustomizedLabel} />

                <CustomLabel />
              </Bar>
              <Bar
                dataKey="target"
                name="Target TMT Sales"
                fill="#dea600"
                // activeBar={<Rectangle fill="#dea600" stroke="#dea600" />}
                onClick={handleBarClick}
              >
                <LabelList dataKey="target" content={renderCustomizedLabel} />

                <CustomLabel />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <DrillStateIndicator drillLevel={drillLevel} />
          {mode === "month" && (
            <div className="text-center text-white mt-2">FY 2024-2025</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SalesChart;

