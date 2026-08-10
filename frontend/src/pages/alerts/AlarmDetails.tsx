import React, { useMemo, useState } from 'react';
import { ArrowLeft, Filter } from "lucide-react";
import { Button } from "../../@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../../@/components/ui/dropdown-menu";
import { LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Line, Bar,BarChart } from 'recharts';
import { Card } from "../../@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from '../../@/components/ui/popover';
import { Calendar } from '../../@/components/ui/calendar';

const AlarmDetailsView = ({ selectedAlarms, setShowAlarmDetails }) => {
  const [visibleColumns, setVisibleColumns] = useState({
    cloud_account_id: true,
    recommendation_type: false,
    id: false,
    cred_id: false,
    alarm_status: false,
    run_id: true,
    alert_id: false,
    created_at: true,
    closed_by: false,
    updated_at: false,
    organization_id: false,
    cloud_provider: true,
    closed_time: false,
    entity_id: false,
    resource_type: true,
    resource_id: true,
    closed_reason: false,
    job_id: true,
    monthly_savings: true,
  });
  const [activeTab, setActiveTab] = useState(0);
  const [selectedMetric, setSelectedMetric] = useState('cpu');
  const [hoveredData, setHoveredData] = useState(null);
  const [selectedGranularity, setSelectedGranularity] = useState('3M');
  const [customDateRange, setCustomDateRange] = useState({ start: null, end: null });


  const alarmDetails = [
    { field: "Cloud Account ID", key: "cloud_account_id" },
    { field: "Recommendation Type", key: "recommendation_type" },
    { field: "ID", key: "id" },
    { field: "Cred ID", key: "cred_id" },
    { field: "Alarm Status", key: "alarm_status" },
    { field: "Run ID", key: "run_id" },
    { field: "Created At", key: "created_at" },
    { field: "Alert ID", key: "alert_id" },
    { field: "Closed By", key: "closed_by" },
    { field: "Updated At", key: "updated_at" },
    { field: "Organization ID", key: "organization_id" },
    { field: "Cloud Provider", key: "cloud_provider" },
    { field: "Closed Time", key: "closed_time" },
    { field: "Resource Type", key: "resource_type" },
    { field: "Entity ID", key: "entity_id" },
    { field: "Resource ID", key: "resource_id" },
    { field: "Closed Reason", key: "closed_reason" },
    { field: "Job ID", key: "job_id" },
    { field: "Monthly Savings", key: "monthly_savings" },
  ];

  const toggleColumnVisibility = (columnKey) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }));
  };

  const visibleAlarmDetails = alarmDetails.filter(detail => visibleColumns[detail.key]);

  // Sample data for the graph
  const graphData = [
    { name: 'Jan', cpu: 60, networkIn: 50, networkOut: 45, diskRead: 20, diskWrite: 30 },
    { name: 'Feb', cpu: 55, networkIn: 55, networkOut: 50, diskRead: 25, diskWrite: 35 },
    { name: 'Mar', cpu: 65, networkIn: 60, networkOut: 55, diskRead: 30, diskWrite: 40 },
    { name: 'Apr', cpu: 70, networkIn: 65, networkOut: 60, diskRead: 35, diskWrite: 45 },
    { name: 'May', cpu: 75, networkIn: 70, networkOut: 65, diskRead: 40, diskWrite: 50 },
    { name: 'Jun', cpu: 80, networkIn: 75, networkOut: 70, diskRead: 45, diskWrite: 55 },
  ];

  const handleMetricClick = (metric) => {
    setSelectedMetric(metric);

  };
  const handleMouseMove = (data) => {
    if (data && data.activePayload) {
      setHoveredData(data.activePayload[0].payload);
    }
  };

  const handleMouseLeave = () => {
    setHoveredData(null);
  };


  const generateStableData = (granularity) => {
    const basePatterns = {
      cpu: [65, 58, 72, 68, 75, 63, 70, 67, 73, 69, 71, 66],
      networkIn: [45, 52, 48, 55, 50, 53, 47, 51, 49, 54, 46, 50],
      networkOut: [40, 45, 42, 47, 43, 46, 41, 44, 42, 45, 40, 43],
      diskRead: [25, 28, 24, 27, 26, 29, 25, 28, 26, 27, 24, 26],
      diskWrite: [35, 38, 36, 39, 37, 40, 36, 39, 37, 38, 35, 37]
    };

    const generateDataPoint = (index, metric) => {
      console.log("ind",index)
      const baseValue = basePatterns[metric][index % basePatterns[metric].length];

      console.log("base",baseValue)
     
      // const variance = ((index * 17) % 4) - 2;
      // console.log('variance',variance) if you want aany variance in data slightly   we can use 
      //  return baseValue+variance

      return baseValue;
    };

    switch (granularity) {
      case '1M':
        return Array.from({ length: 30 }, (_, i) => ({
          name: `Day ${i + 1}`,
          cpu: generateDataPoint(i, 'cpu'),
          networkIn: generateDataPoint(i, 'networkIn'),
          networkOut: generateDataPoint(i, 'networkOut'),
          diskRead: generateDataPoint(i, 'diskRead'),
          diskWrite: generateDataPoint(i, 'diskWrite'),
        }));
      case '3M':
        return Array.from({ length: 12 }, (_, i) => ({
          name: `Week ${i + 1}`,
          cpu: generateDataPoint(i , 'cpu'),
          networkIn: generateDataPoint(i , 'networkIn'),
          networkOut: generateDataPoint(i  , 'networkOut'),
          diskRead: generateDataPoint(i  , 'diskRead'),
          diskWrite: generateDataPoint(i, 'diskWrite'),
        }));
      case '6M':
        return Array.from({ length: 6 }, (_, i) => ({
          name: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][i],
          cpu: generateDataPoint(i, 'cpu'),
          networkIn: generateDataPoint(i, 'networkIn'),
          networkOut: generateDataPoint(i, 'networkOut'),
          diskRead: generateDataPoint(i, 'diskRead'),
          diskWrite: generateDataPoint(i, 'diskWrite'),
        }));
      case '1Y':
        return Array.from({ length: 12 }, (_, i) => ({
          name: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
          cpu: generateDataPoint(i , 'cpu'),
          networkIn: generateDataPoint(i , 'networkIn'),
          networkOut: generateDataPoint(i, 'networkOut'),
          diskRead: generateDataPoint(i , 'diskRead'),
          diskWrite: generateDataPoint(i, 'diskWrite'),
        }));
      default:
        return [];
    }
  };

  // Use useMemo to cache the generated data
  const data = useMemo(() => generateStableData(selectedGranularity), [selectedGranularity]);

  const GranularitySelector = () => (
    <div className="flex gap-2 mb-4">
      <Button
        variant={selectedGranularity === '1M' ? 'default' : 'outline'}
        onClick={() => setSelectedGranularity('1M')}
        className={selectedGranularity === '1M' ? 'bg-[#0047AB] text-white' : ''}
      >
        1 Month
      </Button>
      <Button
        variant={selectedGranularity === '3M' ? 'default' : 'outline'}
        onClick={() => setSelectedGranularity('3M')}
        className={selectedGranularity === '3M' ? 'bg-[#0047AB] text-white' : ''}
      >
        3 Months
      </Button>
      <Button
        variant={selectedGranularity === '6M' ? 'default' : 'outline'}
        onClick={() => setSelectedGranularity('6M')}
        className={selectedGranularity === '6M' ? 'bg-[#0047AB] text-white' : ''}
      >
        6 Months
      </Button>
      {/* <Button
        variant={selectedGranularity === '1Y' ? 'default' : 'outline'}
        onClick={() => setSelectedGranularity('1Y')}
        className={selectedGranularity === '1Y' ? 'bg-[#0047AB] text-white' : ''}
      >
        1 Year
      </Button> */}
      <Popover>
        {/* <PopoverTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Custom
          </Button>
        </PopoverTrigger> */}
        {/* <PopoverContent className="p-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input
                type="date"
                className="w-full rounded-md border p-2"
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input
                type="date"
                className="w-full rounded-md border p-2"
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>
            <Button 
              className="w-full bg-[#0047AB] text-white"
              onClick={() => {
                setSelectedGranularity('custom');
                // Here you would typically fetch data for the custom date range
              }}
            >
              Apply
            </Button>
          </div>
        </PopoverContent> */}
      </Popover>
    </div>
  );

  const MetricCard = ({ metric }) => {
    // Only show hovered value if this metric is selected
    const shouldShowHoveredValue = metric.id === selectedMetric && hoveredData;
    
    const value = shouldShowHoveredValue
      ? hoveredData[metric.id]: null
      // graphData[0] [metric.id];  

    return (
      <button
        onClick={() => setSelectedMetric(metric.id)}
        className={`w-full text-left p-4 rounded-lg transition-colors ${
          selectedMetric === metric.id
            ? 'bg-[#0047AB] text-white'
             : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <div className="flex justify-between items-center">
          <span>{metric.label}</span>
          <div className="text-right">
            <span className="font-semibold">
              {value}
            </span>
            {shouldShowHoveredValue && (
              <div className="text-sm opacity-75">
                {hoveredData.name}
              </div>
            )}
          </div>
        </div>
      </button>
    );
  };


  // const metrics = [
  //   { id: 'cpu', label: 'CPU Usage', color: '#8884d8' },
  //   { id: 'networkIn', label: 'Network In', color: '#82ca9d' },
  //   { id: 'networkOut', label: 'Network Out', color: '#ffc658' },
  //   { id: 'diskRead', label: 'Disk Read', color: '#ff7300' },
  //   { id: 'diskWrite', label: 'Disk Write', color: '#0088fe' },
  // ];
  
  const metrics = [
    { id: 'cpu', label: 'CPU Usage', color: '#4CAF50' },      // Bright green
    { id: 'networkIn', label: 'Network In', color: '#2196F3' }, // Vivid blue
    { id: 'networkOut', label: 'Network Out', color: '#FFC107' }, // Amber
    { id: 'diskRead', label: 'Disk Read', color: '#FF5722' },   // Deep orange
    { id: 'diskWrite', label: 'Disk Write', color: '#9C27B0' }, // Purple
  ];
  

  return (
    <div className="bg-white p-6 rounded-lg">
    <div className="flex justify-between items-center mb-6">
      <h2 className="text-2xl font-bold">Alarm Details</h2>
      <div className="flex space-x-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="bg-[#0047AB] text-white hover:bg-[#002D75] hover:text-white">
              <Filter className="mr-2 h-4 w-4" /> Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            {alarmDetails.map((detail) => (
              <DropdownMenuCheckboxItem
                key={detail.key}
                className="capitalize"
                checked={visibleColumns[detail.key]}
                onCheckedChange={() => toggleColumnVisibility(detail.key)}
              >
                {detail.field}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAlarmDetails(false)}
          className="bg-[#0047AB] text-white hover:bg-[#002D75] hover:text-white"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Alerts
        </Button>
      </div>
    </div>

    <div className="rounded-md border">
      <div className="flex space-x-4 mb-4 p-3 border-b">
        <button
          className={`pb-2 border-b-2 ${activeTab === 0 ? 'border-[#0047AB] text-[#0047AB]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab(0)}
        >
          Alarm Details
        </button>
        <button
          className={`pb-2 border-b-2 ${activeTab === 1 ? 'border-[#0047AB] text-[#0047AB]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab(1)}
        >
          Resource Metrics
        </button>
      </div>

      {activeTab === 0 && (
        <Table className="w-full text-sm text-left rounded-lg">
          <TableHeader className="bg-[#0047AB] text-white">
            <TableRow className="text-white">
              {visibleAlarmDetails.map((detail, index) => (
                <TableHead className="text-white" key={index}>{detail.field}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {selectedAlarms.map((alarm, alarmIndex) => (
              <TableRow key={alarmIndex}>
                {visibleAlarmDetails.map((detail, detailIndex) => (
                  <TableCell key={detailIndex}>
                    {detail.key === 'monthly_savings' 
                      ? alarm.recommendation_data?.monthly_savings ?? 'N/A'
                      : alarm[detail.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

{activeTab === 1 && (
          <div className="flex flex-col p-6">
            <GranularitySelector />
            <div className="flex gap-8">
              <Card className="w-80 p-4 shrink-0">
                <h3 className="text-lg font-semibold mb-4">Metrics</h3>
                <div className="space-y-3">
                  {metrics.map((metric) => (
                    <MetricCard key={metric.id} metric={metric} />
                  ))}
                </div>
              </Card>
              
              <Card className="flex-1 p-6">
                <h3 className="text-lg font-semibold mb-4">
                  {metrics.find(m => m.id === selectedMetric)?.label} Over Time
                </h3>
                <div className="w-full">
                  <BarChart 
                    width={700} 
                    height={400} 
                    data={data}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                  >
                    <XAxis dataKey="name" />
                    <YAxis />
                    <CartesianGrid strokeDasharray="3 3" />
                    <Tooltip/>
                    <Legend />
                    <Bar 
                      dataKey={selectedMetric} 
                      fill={metrics.find(m => m.id === selectedMetric)?.color} 
                    />
                  </BarChart>
                </div>
              </Card>
            </div>
          </div>
        )}
    </div>
  </div>
  );
};

export default AlarmDetailsView;