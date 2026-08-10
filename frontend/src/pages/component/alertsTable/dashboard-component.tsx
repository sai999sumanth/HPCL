import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select";
import { BarChart, LineChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { formatRelativeTime } from '@/hooks/useRelativeTime';
import DataGrid from '@/components/common/DataGrid';
import { Checkbox } from '@/@/components/ui/checkbox';
import { Button } from '@/@/components/ui/button';
import { fetchSupplyMetrics } from './SupplyDashboardApi';

interface DryOutData {
  name: string;
  sap_id: string;
  present_stage: number;
  dry_out_days: string;
}
interface ChartDataPoint {
  name: string;
  value: number;
}
interface MetricsData {
  indent_not_placed: number;
  indent_on_hold: number;
  indent_in_progress: number;
  dry_out: number;
  total_count: number;
}

const SupplyDashboard = () => {
  const [selectedPage, setSelectedPage] = useState("supply-overview");
  const [selectedFilters, setSelectedFilters] = useState({
    all: true,
    cat_a: false,
    full_dry_out: false
  });
  const [selectedZone, setSelectedZone] = useState("all");
  const [selectedDepot, setSelectedDepot] = useState("all");
  const [activeTab, setActiveTab] = useState("all");
  const [metricsData, setMetricsData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [gridData, setGridData] = useState<DryOutData[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([
    { name: 'Jan', value: 400 },
    { name: 'Feb', value: 300 },
    { name: 'Mar', value: 600 },
    { name: 'Apr', value: 800 },
    { name: 'May', value: 500 }
  ]);


  const pageOptions = [
    { value: "supply-overview", label: "All" },
    { value: "pending-indents", label: "Pending Indents" },
    { value: "indents-not-placed", label: "Indents Not Placed" }
  ];
  const zoneOptions = [
    { value: "all", label: "All Zones" },
    { value: "north", label: "North" },
    { value: "south", label: "South" },
    { value: "east", label: "East" },
    { value: "west", label: "West" }
  ];

  const depotOptions = [
    { value: "all", label: "All Depots" },
    { value: "depot1", label: "Depot 1" },
    { value: "depot2", label: "Depot 2" },
    { value: "depot3", label: "Depot 3" }
  ];

  const convertUTCDateToLocalDate = (utcDate: Date): Date => {
    const timezoneOffset = utcDate.getTimezoneOffset();
    return new Date(utcDate.getTime() - (timezoneOffset * 60 * 1000));
  };
  const formatDateTime = (dateString) => {
    try {
      const date = new Date(dateString);
      const localDate = convertUTCDateToLocalDate(date);

      // Format time
      const hours = localDate.getHours().toString().padStart(2, '0');
      const minutes = localDate.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;

      // Format date
      const formattedDate = localDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      // Get relative time
      const relativeTime = formatRelativeTime(dateString);

      return {
        time: timeString,
        date: formattedDate,
        relative: relativeTime
      };
    } catch (error) {
      console.error('Error formatting datetime:', error);
      return {
        time: '--:--',
        date: 'Invalid date',
        relative: 'Unknown time'
      };
    }
  };

  const getMetricsDisplay = () => {
    if (!metricsData) {
      console.log('No metrics data available'); // Debug log
      return [];
    }

    console.log('Current metrics data:', metricsData); // Debug log

    switch (selectedPage) {
      case "supply-overview":
        return [
          { label: "DryOuts", value: metricsData.dry_out || 0 },
          { label: "Indents Not Placed", value: metricsData.indent_not_placed || 0 },
          { label: "Indents on Hold", value: metricsData.indent_on_hold || 0 },
          { label: "Indents In Progress", value: metricsData.indent_in_progress || 0 },
          { label: "Total", value: metricsData.total_count || 0 }
        ];

      // case "pending-indents":
      //   const dateInfo = formatDateTime(metricsData.date);
      //   return [
      //     { label: "Pending Indents", value: metricsData.pending_indents },
      //     { label: "Dealer TT", value: metricsData.dealer_tt },
      //     { label: "TT Available", value: metricsData.tt_available },
      //     { label: "Empty Dealer TT Return", value: metricsData.dealer_tt_return },
      //     { label: "Empty Tpt TT Return", value: metricsData.tt_return },
      //     {
      //       label: "Pending Indents(Date/Time)",
      //       value: dateInfo.relative,
      //       subValue: `${dateInfo.time} | ${dateInfo.date}`
      //     }
      //   ];

      // case "indents-not-placed":
      //   const notPlacedDateInfo = formatDateTime(metricsData.date);
      //   return [
      //     { label: "Indents not Placed", value: metricsData.indents_not_placed },
      //     {
      //       label: "DryOut(Date/Time)",
      //       value: notPlacedDateInfo.relative,
      //       subValue: `${notPlacedDateInfo.time} | ${notPlacedDateInfo.date}`
      //     },
      //     { label: "Dryout<2 days", value: metricsData.dry_out_2days },
      //     { label: "Dryout<7 days", value: metricsData.dry_out_7days },
      //     { label: "Dryout<15 days", value: metricsData.dry_out_15days },
      //     { label: "Dryout<30 days", value: metricsData.dry_out_30days }
      //   ];

      default:
        return [];
    }
  };

  const getFilterOptions = () => {
    switch (selectedPage) {
      case "supply-overview":
        return [
          { id: "all", label: "All" },
          { id: "cat_a", label: "Cat A" }
        ];
      case "pending-indents":
        return [
          { id: "all", label: "All" },
          { id: "cat_a", label: "Cat A" },
          { id: "full_dry_out", label: "Full DryoutMS+HSD" }
        ];
      default:
        return [
          { id: "all", label: "All" },
          { id: "cat_a", label: "Cat A" }
        ];
    }
  };
  const handleFilterChange = (filterId) => {
    if (filterId === "all") {
      setSelectedFilters({
        ...selectedFilters,
        ...Object.keys(selectedFilters).reduce((acc, key) => ({
          ...acc,
          [key]: false
        }), {}),
        all: !selectedFilters.all
      });
    } else {
      setSelectedFilters({
        ...selectedFilters,
        all: false,
        [filterId]: !selectedFilters[filterId]
      });
    }
  };
  const columnDefs = [
    {
      field: 'name',
      headerName: 'Station Name',
      flex: 2,
      sortable: true,
      filter: true
    },
    {
      field: 'sap_id',
      headerName: 'SAP ID',
      flex: 1,
      sortable: true,
      filter: true
    },
    {
      field: 'present_stage',
      headerName: 'Present Stage',
      flex: 1,
      sortable: true,
      filter: true
    },
    {
      field: 'dry_out_days',
      headerName: 'Dry Out Days',
      flex: 1,
      sortable: true,
      filter: true
    }
  ];

  const defaultColDef = {
    resizable: true,
    minWidth: 100
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetchSupplyMetrics();
      console.log('Fetched Data:', response); // Debug log
      setMetricsData(response);
    } catch (error) {
      console.error('Error in dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedPage, activeTab]);
  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;

    const entry = payload[0];
    const { value } = entry;

    return (
      <div className="bg-white shadow-lg rounded-lg p-2 border border-gray-200">
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-xs text-black-600">Value:</span>
            <span className="font-bold text-gray-800 text-xs">{value}</span>
          </div>
        </div>
      </div>
    );
  };return (
    <Card className="bg-gray-50 p-0">

    <div className="p-2 space-y-4 relative">
      <div className="flex items-center gap-4 mb-6">
        {/* Left side controls */}
        <div className="flex items-center gap-4">
          <Button variant="outline" className="text-gray-700 h-10 px-5">
            All India
          </Button>
          
          <Select value={selectedZone} onValueChange={setSelectedZone}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Select zone" />
            </SelectTrigger>
            <SelectContent>
              {zoneOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-4">
            <Select value={selectedDepot} onValueChange={setSelectedDepot}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Select depot" />
              </SelectTrigger>
              <SelectContent>
                {depotOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Checkboxes next to depot select */}
            <div className="flex items-center gap-4">
              {getFilterOptions().map((filter) => (
                <div key={filter.id} className="flex items-center gap-2">
                  <Checkbox
                    id={filter.id}
                    checked={selectedFilters[filter.id]}
                    onCheckedChange={() => handleFilterChange(filter.id)}
                  />
                  <label
                    htmlFor={filter.id}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {filter.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right side page selector */}
        <div className="ml-auto">
          <Select value={selectedPage} onValueChange={setSelectedPage}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select view" />
            </SelectTrigger>
            <SelectContent>
              {pageOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {/* Metrics Card */}
      <Card className="w-full">
        {/* <CardHeader className="p-2">
          <CardTitle className="text-xs">Supply Metrics</CardTitle>
        </CardHeader> */}
          <CardContent className="p-2">
            {loading ? (
              <div className="text-center py-2 text-sm">Loading...</div>
            ) : (
              <div className="flex justify-between items-center">
                {getMetricsDisplay().map((metric, index) => (
                  <React.Fragment key={metric.label}>
                    <div className="text-center px-1">
                      {/* Make the number larger */}
                      <p className="text-xl font-bold">{metric.value}</p>
                      {/* {metric.subValue && (
                        <p className="text-xs text-gray-400">{metric.subValue}</p>
                      )} */}
                      <p className="text-xs text-gray-500">{metric.label}</p>
                    </div>
                    {index < getMetricsDisplay().length - 1 && (
                      <div className="h-8 w-px bg-gray-200" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
          </CardContent>

      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-4 gap-1">
        {/* Bar Chart */}
        <Card>
          <CardHeader className="p-2">
            <CardTitle className="text-xs">Supply Trends</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <BarChart width={250} height={130} data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip active={true} payload={chartData} />} />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          </CardContent>
        </Card>
        {/* Line Chart */}
        <Card>
          <CardHeader className="p-2 relative">
            <CardTitle className="text-xs">Monthly Progress</CardTitle>
            <span className="absolute top-0.5 right-2 text-xs text-gray-500 bg-gray-100 px-1 rounded">
              Representative Chart
            </span>
          </CardHeader>
          <CardContent className="p-2">
            <LineChart width={250} height={130} data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                content={
                  <CustomTooltip active={true} payload={chartData} />
                }
              />              <Line type="monotone" dataKey="value" stroke="#82ca9d" />
            </LineChart>
          </CardContent>
        </Card>
        {/* Bar Chart */}
        <Card>
          <CardHeader className="p-2 relative">
            <CardTitle className="text-xs">Supply Trends</CardTitle>
            <span className="absolute top-0.5 right-2 text-xs text-gray-500 bg-gray-100 px-1 rounded">
              Representative Chart
            </span>
          </CardHeader>
          <CardContent className="p-2">
            <BarChart width={250} height={130} data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                content={
                  <CustomTooltip active={true} payload={chartData} />
                }
              />              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          </CardContent>
        </Card>
        {/* Line Chart */}
        <Card>
          <CardHeader className="p-2 relative">
            <CardTitle className="text-xs">Monthly Progress</CardTitle>
            <span className="absolute top-0.5 right-2 text-xs text-gray-500 bg-gray-100 px-1 rounded">
              Representative Chart
            </span>
          </CardHeader>
          <CardContent className="p-2">
            <LineChart width={250} height={130} data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                content={
                  <CustomTooltip active={true} payload={chartData} />
                }
              />
              <Line type="monotone" dataKey="value" stroke="#82ca9d" />
            </LineChart>
          </CardContent>
        </Card>



        {/* Pie Chart
        <Card>
          <CardHeader className="p-2">
            <CardTitle className="text-xs">Distribution</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <PieChart width={250} height={130}>
              <Pie
                data={currentData.chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={50}
              >
                {currentData.chartData.map((_, index) => (
                  <Cell key={index} fill={`#${Math.floor(Math.random()*16777215).toString(16)}`} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </CardContent>
        </Card> */}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Supply Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-[400px]">
            <DataGrid
              rowData={gridData}
              columnDefs={columnDefs}
              loading={loading}
              height="400px"
              pagination={true}
              paginationPageSize={10}
              enableRangeSelection={true}
              suppressRowClickSelection={true}
              animateRows={true}
              className="w-full h-full"
            />
          </div>
        </CardContent>
      </Card>
    </div>
    </Card>

  );
};

export default SupplyDashboard;
