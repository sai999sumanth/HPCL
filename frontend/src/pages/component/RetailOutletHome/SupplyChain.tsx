// import React, { useState } from 'react';
// import { Card, CardContent, CardHeader, CardTitle } from "../../../@/components/ui/card";
// import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,  Cell} from 'recharts';
// import LocationTable from '../RetailTerminalHome/Table'
// import LocationDetails from '../RetailTerminalHome/Graphs';
// import terminalIcon from '../../../assets/images/oil-barrel.png';
// import { Button } from '../../../@/components/ui/button';
// import TopLocationsCard from '../RetailTerminalHome/TopLocationCards';
// import AlertDashboardCards from '../RetailTerminalHome//TopLocationCards';
// import DashboardCards from '../RetailTerminalHome/DashboardGraphs';
// import DashboardGraph from '../RetailTerminalHome/alerts/graph'; // Import the DashboardGraph component
// import { Tabs, TabList, TabPanels, Tab, TabPanel } from '@chakra-ui/react';
// import { ROAlertsTable } from '../alertsTable/ROAlertsTable';
// import { ReusableTable, TableColumn } from '../../../components/common/Reusable/ReusableTable';


// interface CustomizedAxisTickProps { 
//   x: number;
//   y: number;
//   payload: {
//     value: string;
//   };
// }

// const CustomizedAxisTick = ({ x, y, payload }: CustomizedAxisTickProps) => {
//   const maxCharsPerLine = 8;
//   const words = payload.value.split(' ');
//   const lines: string[] = [];
//   let currentLine = '';

//   // Break text into lines

//   words.forEach(word => { 
//     const testLine = currentLine ? `${currentLine} ${word}` : word;
//     if (testLine.length <= maxCharsPerLine) { 
//       currentLine = testLine;
//     } else {
//       lines.push(currentLine);
//       currentLine = word;
//     }
//   });
//   if (currentLine) {
//     lines.push(currentLine);
//   }

//   return ( 
//     <g transform={`translate(${x},${y})`}>
//       {lines.map((line, index) => (
//         <text
//           key={index}
//           x={0}
//           y={index * 12}
//           dy={7}
//           textAnchor="middle"
//           fill="#666"
//           fontSize={10}
//         >
//           {line}
//         </text>
//       ))}
//     </g>
//   );
// };

// const ClosedAlertsTable = () => {
//   // Reusing ROAlertsTable component with different query
//   return <ROAlertsTable query="bu='RO' AND alert_status='Closed'" />;
// };

// const SupplyChain = () => {

//   const [showLocationDetails, setShowLocationDetails] = useState(false);
//   const [selectedLocation, setSelectedLocation] = useState(null);
//   const [activeTab, setActiveTab] = useState(0);
//   const [loadedTabs, setLoadedTabs] = useState<Set<number>>(new Set([0])); // Start with first tab loaded

//   const handleTabChange = (index: number) => {
//     setActiveTab(index);
//     setLoadedTabs(prev => new Set([...prev, index]));
//   };

//   const handleLocationClick = (location) => { 
//     setSelectedLocation(location);
//     setShowLocationDetails(true);
//   };

//   const handleBackToHome = () => { 
//     setSelectedLocation(null);
//     setShowLocationDetails(false);
//   };

//   const colors = ['#1e3a8a', '#1d4ed8', '#3b82f6', '#b1d4ff'];

//   // Alert Priority Data

//   const alertPriorityData = {
//     critical: 67,
//     high: 2631,
//     low: 22
//   };
  
//   // Operability Index Data
//   const operabilityData = [
//     { name: 'Oct 1', value: 99 },
//     { name: 'Oct 10', value: 98 },
//     { name: 'Oct 20', value: 97 },
//     { name: 'Oct 30', value: 99 }
//   ];

//   // Alert Aging Data
//   const alertAgingData = [
//     { name: 'Days >20', value: 440 },
//     { name: '15-20', value: 118 },
//     { name: '5-15', value: 125 },
//     { name: '0-5', value: 1833 }
//   ];

//   // TAS Alerts Data
//   const tasAlertsData = [
//     { name: 'Supplemental Reports', value: 58 },
//     { name: 'Critical Reports', value: 110 },
//     { name: 'Process Reports', value: 22 },
//     { name: 'QC', value: 2 },
//     { name: 'Others', value: 18 }
//   ];

//   // Non-TAS Alerts Data
//   const nonTasAlertsData = [
//     { name: 'VTS', value: 1769 },
//     { name: 'EM Locks', value: 6 },
//     { name: 'CCTV', value: 43 },
//     { name: 'VTS Exception', value: 492 }
//   ];

//   // VTS Deviation Data

//   const vtsDeviationData = [ 
//     { name: 'Route Break', value: 2 },
//     { name: 'Speed Limit', value: 7 },
//     { name: 'Location Break', value: 1 },
//     { name: 'Time Break', value: 2 },
//     { name: 'No VTS', value: 15 },
//     { name: 'No Entry', value: 4 },
//     { name: 'LPA', value: 6 },
//     { name: 'VTS Exception', value: 58 }
//   ];

//   const timeRangeButtons = ['1', '3', '6', '9', '12'];


//   const mockData: any[] = [
//     {
//       unit: '1181',
//       unitName: 'Piyala',
//       priority: 'LOW',
//       personInCharge: 'Tudu Ram Chandra, 9437185990, Location In-charge',
//       score: 88,
//       rank: 66
//     },
//     {
//       unit: '1117',
//       unitName: 'Gonda',
//       priority: 'NORMAL',
//       personInCharge: 'Cm Khodwe, 9766128390, Location In-charge',
//       score: 93,
//       rank: 65
//     },
//     {
//       unit: '1192',
//       unitName: 'Bangalore',
//       priority: 'HIGH',
//       personInCharge: 'Rajesh Kumar, 9876543210, Location In-charge',
//       score: 75,
//       rank: 89
//     }
//   ];
  
//   const PerformanceTable: React.FC = () => {
//     const [currentPage, setCurrentPage] = useState(0);
//     const [pageSize, setPageSize] = useState(10);
//     const [loading, setLoading] = useState(false);
  
//     const columns: TableColumn<any>[] = [
//       { 
//         header: 'Unit',
//         accessorKey: 'unit',
//         enableSorting: true,
//         width: 160
//       },
//       { 
//         header: 'Unit Name',
//         accessorKey: 'unitName',
//         enableSorting: true,
//         width: 180
//       },
//       { 
//         header: 'Priority',
//         accessorKey: 'priority',
//         width: 100,
//         cell: ({ row }) => (
//           <div className={`px-2 py-1 rounded-full text-center ${
//             row.original.priority === 'LOW' ? 'bg-blue-100 text-blue-800' :
//             row.original.priority === 'HIGH' ? 'bg-red-100 text-red-800' :
//             'bg-gray-100 text-gray-800'
//           }`}>
//             {row.original.priority}
//           </div>
//         )
//       },
//       { 
//         header: 'Person In Charge',
//         accessorKey: 'personInCharge',
//         width: 350
//       },
//       { 
//         header: 'Operability Index Score',
//         accessorKey: 'score',
//         enableSorting: true,
//         width: 180,
//         cell: ({ row }) => (
//           <div className={`font-medium ${
//             row.original.score >= 90 ? 'text-green-600' :
//             row.original.score >= 80 ? 'text-yellow-600' :
//             'text-red-600'
//           }`}>
//             {row.original.score}
//           </div>
//         )
//       },
//       { 
//         header: 'Rank',
//         accessorKey: 'rank',
//         enableSorting: true,
//         width: 200
//       }
//     ];
  
//     // Pagination calculations
//     const paginatedData = mockData.slice(
//       currentPage * pageSize,
//       (currentPage + 1) * pageSize
//     );
  
//     const handleEditRecord = (record: any) => {
//       console.log('Edit record:', record);
//     };
  
//     const handleDeleteRecord = (record:any) => {
//       console.log('Delete record:', record);
//     };
  
//     return (
//       <div className="w-full">
//         <ReusableTable
//           data={paginatedData}
//           columns={columns}
//           searchField="unitName"
//           isLoading={loading}
//           onEdit={handleEditRecord}
//           onDelete={handleDeleteRecord}
//           pagination={{
//             pageIndex: currentPage,
//             pageSize: pageSize,
//             totalRows: mockData.length,
//             onPageChange: setCurrentPage,
//             onPageSizeChange: (newPageSize) => {
//               setPageSize(newPageSize);
//               setCurrentPage(0); // Reset to first page when changing page size
//             }
//           }}
//         />
//       </div>
//     );
//   };

//   return (  
//     <div className="p-1 space-y-6">
//       {showLocationDetails ? (
//         <LocationDetails location={selectedLocation} onBackToHome={() => handleBackToHome} />
//       ) : (
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
//         {/* Retail Terminal Card */}
//      <Card>
//       <CardHeader>
//         <CardTitle>Retail Outlet</CardTitle>
//       </CardHeader>
//       <CardContent>
//         <div className="flex flex-col items-center space-y-6">
//           {/* Center image */}
//           <div className="w-32 h-32 flex items-center justify-center" >
//             <img 
//               src={terminalIcon}
//               alt="Retail Terminal"
//               className="object-contain"
//             />
//           </div>
//           {/* Alert Priority Header */}
//           {/* Alert Types */}
//           <div className="w-full space-y-1">
//           <h3 className="text-sm font-medium">Alert Priority</h3>

//             <div className="flex items-center justify-between">
//               <span className="text-red-500 font-medium">Critical</span>
//               <span>{alertPriorityData.critical}</span>
//             </div>
//             <div className="flex items-center justify-between">
//               <span className="text-yellow-500 font-medium">High</span>
//               <span>{alertPriorityData.high}</span>
//             </div>
//             <div className="flex items-center justify-between">
//               <span className="text-blue-500 font-medium">Low</span>
//               <span>{alertPriorityData.low}</span>
//             </div>
//           </div>
//         </div>
//       </CardContent>
//      </Card>

//         {/* Operability Index Card */}

//         <Card>
//       <CardHeader>
//       <CardTitle>
//               Avg. Operability Index
//             </CardTitle>
//             <div className="flex gap-1 justify-end">
//               Months
//                 {timeRangeButtons.map((month) => (
//                   <Button
//                     key={month}
//                     variant="outline"
//                     size="sm"
//                     className="h-8 w-8"
//                   >
//                     {month}
//                   </Button>
//                 ))}
//               </div>
//       </CardHeader>
//       <CardContent>
//         <ResponsiveContainer width="100%" height={200}>
//           <AreaChart data={operabilityData}>
//             <defs>
//               <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
//               <stop offset="0%" stopColor="#04C6F6" stopOpacity={1} />
//     <stop offset="55%" stopColor="#04C6F6" stopOpacity={0.9} />
//     <stop offset="75%" stopColor="#20a4ff" stopOpacity={0.8} />
//     <stop offset="100%" stopColor="#0684D0" stopOpacity={1} />
//               </linearGradient>
//             </defs>
//             {/* Removed CartesianGrid completely */}
//             <XAxis 
//               dataKey="name" 
//               axisLine={false} 
//               tickLine={false}
//               tick={{ fill: '#666', fontSize: 12 }}
//             />
//             <YAxis 
//               domain={[0, 100]} 
//               axisLine={false} 
//               tickLine={false}
//               tick={{ fill: '#666', fontSize: 12 }}
//             />
//             <Tooltip />
//             <Area
//               type="monotone"
//               dataKey="value"
//               stroke="#1e40af"
//               fill="url(#colorGradient)"
//               strokeWidth={2}
//             />
//           </AreaChart>
//         </ResponsiveContainer>
//       </CardContent>
//     </Card>


//         {/* Alert Aging Card */}
//         <Card>
//       <CardHeader>
//         <CardTitle className="flex justify-between">
//           <span>Alert Aging</span>
//           <span className="text-base font-bold">2514</span>
//         </CardTitle>
//       </CardHeader>
//       <CardContent>
//         <ResponsiveContainer width="100%" height={230}>
//           <BarChart 
//             data={alertAgingData}
//             margin={{
//               top: 20,
//               right: 20,
//               left: 20,
//               bottom: 20,
//             }}
//           >
//             <XAxis 
//               dataKey="name" 
//               axisLine={false} 
//               tickLine={false}
//               tick={{ fill: '#666', fontSize: 12 }}
//             />
//             <Tooltip 
//             />
//             <Bar
//               dataKey="value"
//               radius={[10, 10, 0, 0]}
//               label={{ 
//                 position: 'top',
//                 fill: '#666',
//               }}
//             >
//               {
//                 alertAgingData.map((entry, index) => (
//                   <Cell key={`cell-${index}`} fill={colors[index]} />
//                 ))
//               }
//             </Bar>
//           </BarChart>
//         </ResponsiveContainer>
//       </CardContent>
//     </Card>

//     <div className="col-span-full">
//     <AlertDashboardCards />
//     <DashboardCards />
//   </div>

//         <Card>
//       <CardHeader>
//         <CardTitle className="flex justify-between">
//           <span>TAS Alerts</span>
//           <span className="text-base font-bold">210</span>
//         </CardTitle>
//       </CardHeader>
//       <CardContent>
//         <ResponsiveContainer width="110%" height={270}>
//           <BarChart 
//             data={tasAlertsData}
//             margin={{
//               top: 20,
//               right: 30,
//               left: 20,
//               bottom: 40,
//             }}
//           >
//             <XAxis 
//               dataKey="name" 
//               height={60} 
//               axisLine={false}
//               tickLine={false}
//               interval={0}
//               tick={CustomizedAxisTick}
//               />
//             <Tooltip />
//             <Bar 
//               dataKey="value" 
//               fill="#2563eb" 
//               radius={[3, 3, 0, 0]}
//               label={{ position: 'top' }}
//               />
//           </BarChart>
//         </ResponsiveContainer>
//       </CardContent>
//     </Card>

//         {/* Non-TAS Alerts Card */}
//         <Card>
//           <CardHeader>
//             <CardTitle className="flex justify-between">
//               <span>Non TAS Alerts</span>
//               <span className="text-base font-bold">2304</span>
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//           <ResponsiveContainer width="110%" height={270}>
//           <BarChart 
//             data={nonTasAlertsData}
//             margin={{
//               top: 20,
//               right: 30,
//               left: 20,
//               bottom: 40,
//             }}
//           >
//             <XAxis 
//               dataKey="name" 
//               height={60} 
//               axisLine={false}
//               tickLine={false}
//               interval={0}
//               tick={CustomizedAxisTick}
//               />
//             <Tooltip />
//             <Bar 
//               dataKey="value" 
//               fill="#2563eb" 
//               radius={[3, 3, 0, 0]}
//               label={{ position: 'top' }}
//               />
//           </BarChart>
//         </ResponsiveContainer>
//           </CardContent>
//         </Card>

//         {/* VTS Deviation Card */} 
//         <Card>
//           <CardHeader>
//             <CardTitle className="flex justify-between">
//               <span>VTS Deviation Lorry Blocked</span>
//               <span className="text-base font-bold">1384</span>
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//           <ResponsiveContainer width="110%" height={270}>
//           <BarChart 
//             data={vtsDeviationData}
//             margin={{
//               top: 20,
//               right: 30,
//               left: 20,
//               bottom: 40,
//             }}
//           >
//             <XAxis 
//               dataKey="name" 
//               height={60} 
//               axisLine={false}
//               tickLine={false}
//               interval={0}
//               tick={CustomizedAxisTick}
//               />             
//             <Tooltip />
//             <Bar 
//               dataKey="value" 
//               fill="#2563eb" 
//               radius={[3, 3, 0, 0]}
//               label={{ position: 'top' }}
//               />
//           </BarChart>
//         </ResponsiveContainer>
//           </CardContent>
//         </Card>          
//         <div className="col-span-full">
//   <Tabs 
//     variant="enclosed" 
//     colorScheme="blue" 
//     className="w-full"
//     index={activeTab}
//     onChange={handleTabChange}
//   >
// <TabList className="bg-white border-b">
//       <Tab className={`px-6 py-3 font-medium relative transition-colors ${activeTab === 0 ? 'text-blue-600' : 'text-gray-600'}`}>
//         <span className="relative">
//           Locations
//           {activeTab === 0 && (
//             <span className="absolute bottom-[-12px] left-0 w-full h-0.5 bg-blue-600" />
//           )}
//         </span>
//       </Tab>
//       <Tab className={`px-6 py-3 font-medium relative transition-colors ${activeTab === 1 ? 'text-blue-600' : 'text-gray-600'}`}>
//         <span className="relative">
//           Open Alerts
//           {activeTab === 1 && (
//             <span className="absolute bottom-[-12px] left-0 w-full h-0.5 bg-blue-600" />
//           )}
//         </span>
//       </Tab>
//       <Tab className={`px-6 py-3 font-medium relative transition-colors ${activeTab === 2 ? 'text-blue-600' : 'text-gray-600'}`}>
//         <span className="relative">
//           Closed Alerts
//           {activeTab === 2 && (
//             <span className="absolute bottom-[-12px] left-0 w-full h-0.5 bg-blue-600" />
//           )}
//         </span>
//       </Tab>
//       <Tab className={`px-6 py-3 font-medium relative transition-colors ${activeTab === 3 ? 'text-blue-600' : 'text-gray-600'}`}>
//         <span className="relative">
//           Performance Index
//           {activeTab === 3 && (
//             <span className="absolute bottom-[-12px] left-0 w-full h-0.5 bg-blue-600" />
//           )}
//         </span>
//       </Tab>
//     </TabList>

//     <TabPanels className="bg-white p-4">
//       <TabPanel>
//         {loadedTabs.has(0) && (
//           <LocationTable query="bu='RO'" onLocationClick={handleLocationClick} />
//         )}
//       </TabPanel>
//       <TabPanel>
//         {loadedTabs.has(1) && (
//           <ROAlertsTable query="bu='RO' AND alert_status!='Close' AND interlock_name='Indent Dry Out'" />
//         )}
//       </TabPanel>
//       <TabPanel>
//         {loadedTabs.has(2) && (
//           <ROAlertsTable query="bu='RO' AND alert_status='Close' AND interlock_name='Indent Dry Out'" />
//         )}
//       </TabPanel>
//       <TabPanel>
//         {loadedTabs.has(3) && <PerformanceTable />}
//       </TabPanel>
//     </TabPanels>
//   </Tabs>
// </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default SupplyChain;






import { Center } from '@chakra-ui/react';
import React, { useState, useEffect } from 'react';
import { Tooltip, Button, IconButton, Box } from '@mui/material';
import CircleIcon from '@mui/icons-material/Circle';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import axios from 'axios';
import { fontSize } from '@mui/system';
import { keyframes } from '@mui/system';
import { Card, CardContent, CardHeader, CardTitle } from '@/@/components/ui/card';
import ModalDialogBox from '@/pages/custom-dashboard/charts/ModalDialogBox';
import { apiClient } from '@/services/apiClient';

const expandBar = keyframes`
  0% {
    width: 0%;
  }
  100% {
    width: 90%;
  }
`;

export default function BarWithDotIcon(props: any) {
  const [isOpen, setIsOpen] = useState(false);
  let txt = <div><strong>{props.top}</strong> <br /><strong>{props.bottom}</strong></div>;
  let animationDuration = '2s';
  const openModal = () => {
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
  };
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'left', width: '100%' }}>
        <Box
          sx={{
            width: '98%',
            height: 2,
            backgroundColor: '#2caffe',
            borderRadius: 5,
            position: 'relative',
            animation: `${expandBar} ${animationDuration} ease-in-out`
          }}
        >
          <Tooltip title={txt} arrow>
            <IconButton
              sx={{
                position: 'absolute',
                right: -6,
                top: '50%',
                transform: 'translateY(-50%)',
                padding: 0,
                color: '#2caffe',
              }}
            >
              <CircleIcon fontSize="small" sx={{ fontSize: '10px' }} onClick={openModal} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      {isOpen && <ModalDialogBox props={props} isOpen={isOpen} sap_id={props.sap_id} sendDataToParent={closeModal} />}
    </>
  );
}

// React Functional Component for Horizontal Bar Chart
export function CustomChart() {
  const [chartData, setChartData] = useState<any>(null);
  const [topData, setTopData] = useState<any>(null);
  const [bottomData, setBottomData] = useState<any>(null);
  const [roleLength, setRoleLength] = useState<any>(0);
  const [zoneData, setZoneData] = useState<any>([]);
  const [stateData, setStateData] = useState<any>([]);
  const [areaData, setAreaData] = useState<any>([]);
  const [plantData, setPlantData] = useState<any>([]);
  const [regionData, setRegionData] = useState<any>([]);
  const [zoneName, setZoneName] = useState<any>('');
  const [stateName, setStateName] = useState<any>('');
  const [plantName, setPlantName] = useState<any>('');
  const [regionName, setRegionName] = useState<any>('');
  const [areaName, setAreaName] = useState<any>('');
  const [bigNumbers, setBigNumbers] = useState<any>([]);

  const fetchFilterData = async (column: string, whereCond: object) => {
    const params: any = {
      connection_id: "",
      schema: "public",
      table: "alerts",
      column: [column],
      where_cond: whereCond
    };

    try {
      const response = await apiClient.post('/api/charts/get_distinct_values', params);

      if (response && response.data.status === true) {
        return response.data['data'][column];  // Dynamically return the specific column data
      }

      if (response) {
        console.log(response.data);
      }
      return response;
    } catch (error) {
      throw new Error(`Failed to fetch data for column: ${column}`);
    }
  }

  const getZonesData = async () => {
    const data = await fetchFilterData("zone", { interlock_name: "Indent Dry Out" });
    setZoneData(data);
  }

  const getRegionsData = async (region: any) => {
    const data = await fetchFilterData("region", { interlock_name: "Indent Dry Out", region });
    setRegionData(data);
  }

  const getStatesData = async (zone: any) => {
    const data = await fetchFilterData("state", { interlock_name: "Indent Dry Out", zone });
    setStateData(data);
  }

  const getAreasData = async (state: any) => {
    const data = await fetchFilterData("region", { interlock_name: "Indent Dry Out", state });
    setAreaData(data);
  }

  const getDistinctPlant = async (region: any) => {
    let params = {
      region: region
    }
    try {
      const response = await apiClient.post('/api/indentdryout/get_distinct_plant', params);
      console.log("response", response);
      setPlantData(response.data);
    } catch (error) {
      throw new Error('Failed to fetch users');
    }
  }

  const fetchOutletData = async () => {
    let params: any = {
      filters: [{
        key: 'interlock_name',
        cond: '=',
        value: 'Indent Dry Out'
      }]
    }
    try {
      const response = await apiClient.post('/api/indentdryout/get_dried_out_plants', params);
      if (response && response.data.status === true) {
        setChartData(response.data['data']);
        setTopData(response.data['top_x_axis']);
        setBottomData(response.data['bottom_x_axis']);
        setRoleLength(response.data['bottom_x_axis'].length);
        setBigNumbers(response.data?.['stats']);
      }
      return response;
    } catch (error) {
      throw new Error('Failed to fetch users');
    }
  }

  useEffect(() => {
    fetchOutletData();
    getZonesData();
  }, [])

  const numbers = Array.from({ length: roleLength }, (_, index) => index + 1);
  const handleChange = (event: any) => {
    let title = event.target.name;
    let value = event.target.value;
    if (title === 'zoneName') { setZoneName(value); setStateName(''); setAreaName(''); getStatesData(value); }
    if (title === 'stateName') { setStateName(value); setAreaName(''); getAreasData(value); }
    // if (title === 'regionName') { setRegionName(value); setStateName(''); setAreaName(''); getDistinctPlant(value); }
    if (title === 'areaName') { setAreaName(value); getDistinctPlant(value); }
    if (title === 'plantName') { setPlantName(value); }
  }

  const getChartData = async () => {
    let params: any = {
      "filters": [
        {"key": "interlock_name","cond":"=","value":"Indent Dry Out"}, 
        {"key": "zone","cond":"=","value": zoneName}, 
        {"key": "region", "cond": "=", "value": areaName},
        {"key": "plant", "cond": "=", "value": plantName}
      ]
    }
    const res = await apiClient.post('/api/indentdryout/get_dried_out_plants', params);

    if (res && res.data.status === true) {
      setChartData(res.data['data']);
      setBigNumbers(res.data?.['stats']);
    }
  }

  const reset = () => {
    setZoneName('');
    setStateName('');
    setAreaName('');
    fetchOutletData();
  }
  const getLimitTxt = (text: any, maxLength: number) => {
    let shortenedText = text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
    return shortenedText;
  }

  return (
    <>
      <div className="mb-3">
        <FormControl sx={{ m: 0, paddingRight: 1, minWidth: 200 }} size="small">
          <InputLabel htmlFor="select-zoneName">Zone</InputLabel>
          <Select
            id="select-zoneName"
            label="Zone"
            name="zoneName"
            onChange={handleChange}
            value={zoneName}>
            <MenuItem value=""><em>None</em></MenuItem>
            {zoneData.length>0 && zoneData.map((name: any) => (
              <MenuItem key={name} value={name}>{name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        {/* <FormControl sx={{ m: 1, minWidth: 200 }} size="small">
          <InputLabel htmlFor="select-regionName">Region</InputLabel>
          <Select
            id="select-regionName"
            label="Region"
            name="regionName"
            onChange={handleChange}
            value={regionName}>
            <MenuItem value=""><em>None</em></MenuItem>
            {zoneData.length>0 && zoneData.map((name: any) => (
              <MenuItem key={name} value={name}>{name}</MenuItem>
            ))}
          </Select>
        </FormControl> */}
        <FormControl sx={{ m: 0, paddingRight: 1, minWidth: 200, fontSize: '0.700rem' }} size="small">
          <InputLabel htmlFor="select-stateName">State</InputLabel>
          <Select
            id="select-stateName"
            label="State"
            name="stateName"
            value={stateName}
            onChange={handleChange}
          >
            <MenuItem value=""><em>None</em></MenuItem>
            {stateData.length>0 && stateData.map((name: any) => (
              <MenuItem key={name} value={name}>{name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ m: 0, paddingRight: 1, minWidth: 200, fontSize: '0.700rem' }} size="small">
          <InputLabel htmlFor="select-areaName">Sales Area</InputLabel>
          <Select
            id="select-areaName"
            label="Sales Area"
            name="areaName"
            value={areaName}
            onChange={handleChange}
          ><MenuItem value=""><em>None</em></MenuItem>
            {areaData.length>0 && areaData.map((name: any) => (
              <MenuItem key={name} value={name}>{name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ m: 0, paddingRight: 1, minWidth: 200, fontSize: '0.700rem' }} size="small">
          <InputLabel htmlFor="select-plantName">Plant</InputLabel>
          <Select
            id="select-roName"
            label="Plant"
            name="plantName"
            value={plantName}
            onChange={handleChange}
          >
            <MenuItem value=""><em>None</em></MenuItem>
            {plantData.length > 0 && plantData.map((name: any) => (
              <MenuItem key={name} value={name}>{name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl sx={{ m: 0, paddingRight: 1, minWidth: 120, fontSize: '0.700rem' }}>
          <Button variant="outlined" onClick={getChartData} disabled={zoneName === '' ? true : false}>
            Search
          </Button>
        </FormControl>
        <FormControl sx={{ m: 0, paddingRight: 1, minWidth: 120, fontSize: '0.700rem' }}>
          <Button variant="outlined" onClick={reset} disabled={zoneName === '' ? true : false}>
            Reset
          </Button>
        </FormControl>
      </div>

      <div className="grid sm:grid-cols-3 md:grid-cols-6 gap-2">
        {
          bigNumbers.length > 0 && bigNumbers.map((item: any) => (
            <Card className="w-full max-w-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {item.section}
                </CardTitle>
                {/* {Icon && <Icon className="h-4 w-4 text-muted-foreground" />} */}
              </CardHeader>
              <CardContent className="p-2">
                <div className="text-2xl font-bold">{item.value}</div>
              </CardContent>
            </Card>
          ))
        }
      </div>

      <div style={{ fontFamily: 'Arial, sans-serif', margin: '10px', fontSize: '0.700rem', overflowY: 'auto', maxHeight: '448px' }}>
        {chartData && topData && bottomData && <table style={{ width: '100%', margin: '0 auto', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
          <thead>
            <tr style={{ textAlign: 'center', backgroundColor: '#f7f7f7', color: '#000', position: 'sticky', top: 0, zIndex: '49' }}>
              <td style={{ width: '1%' }}>Days<br />(dryout)</td>
              <td style={{ width: '15%' }}>Retail Outlet</td>
              {numbers && numbers.map((num, index) => (
                <td><Tooltip title={topData[index]} placement="top">
                  <span>{topData[index]}</span>
                </Tooltip></td>
              ))}
            </tr>
          </thead>
          <tbody>
            {chartData.map((item: any, index: number) => (
              <tr key={index} style={{ textAlign: 'center', height: '1rem' }}>
                <td>{item.dry_out_days}</td>
                <td style={{ textAlign: 'left' }}>
                  <Tooltip title={topData[index]} placement="top">
                    <span>{getLimitTxt(item.name, 25)}</span>
                  </Tooltip>
                </td>
                <td colSpan={item.present_stage}>
                  <BarWithDotIcon sap_id={item.sap_id} top={topData[item.present_stage - 1]} bottom={bottomData[item.present_stage - 1]} /></td>
                {roleLength > item.present_stage && <td colSpan={roleLength - item.present_stage}></td>}
              </tr>
            ))}
            <tr style={{ textAlign: 'center', backgroundColor: '#f7f7f7', color: '#000', position: 'sticky', bottom: 0 }}>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              {numbers && numbers.map((num, index) => (
                <td><Tooltip title={bottomData[index]} placement="top">
                  <span>{bottomData[index]}</span>
                </Tooltip></td>
              ))}
            </tr>
          </tbody>
        </table>}
      </div>

    </>
  );
};
