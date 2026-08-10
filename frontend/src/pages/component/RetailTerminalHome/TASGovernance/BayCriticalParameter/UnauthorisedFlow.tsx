


// import React, { useEffect, useState, useCallback, useRef } from 'react';
// import { apiClient } from '@/services/apiClient';
// import { Loader2, AlertCircle } from 'lucide-react';
// import * as am5 from '@amcharts/amcharts5';
// import * as am5percent from '@amcharts/amcharts5/percent';
// import * as am5plugins_exporting from '@amcharts/amcharts5/plugins/exporting';
// import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
// import { Card, CardHeader, CardTitle, CardContent } from '@/@/components/ui/card';
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/@/components/ui/dialog';

// interface UnauthorisedFlowProps {
//   selectedBu: string;
//   selectedZone: string | null;
//   selectedPlant: string | null;
//   selectedTimeFilter: string | null | { key: string; cond: string; value: string };
//   refreshKey: number;
// }

// interface UnauthorisedFlowData {
//   [key: string]: any;
// }

// interface LocationData {
//   location_name: string;
//   count: number;
//   devices: DeviceData[];
// }

// interface DeviceData {
//   device_name: string;
//   cnt: number;
//   dates: string[];
// }

// const UnauthorisedFlow: React.FC<UnauthorisedFlowProps> = ({
//   selectedBu,
//   selectedZone,
//   selectedPlant,
//   selectedTimeFilter,
//   refreshKey,
// }) => {
//   const [data, setData] = useState<UnauthorisedFlowData[]>([]);
//   const [isLoading, setIsLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [plantData, setPlantData] = useState<Array<{ id: string; name: string }>>([]);
//   const [summaryCount, setSummaryCount] = useState<number | null>(null);
//   const plantDataRef = useRef<Array<{ id: string; name: string }>>([]);
//   const chartRef = useRef<HTMLDivElement>(null);
//   const rootRef = useRef<am5.Root | null>(null);
//   const [selectedLocation, setSelectedLocation] = useState<any>(null);
//   const [deviceModalOpen, setDeviceModalOpen] = useState(false);

//   // Convert time filter to date range
//   const getDateRange = useCallback(() => {
//     const now = new Date();
//     const fmt = (d: Date) =>
//       `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

//     if (selectedTimeFilter && typeof selectedTimeFilter === 'object' && 'value' in selectedTimeFilter) {
//       // Custom date range - value format: "startDate,endDate"
//       const dateRangeStr = selectedTimeFilter.value;
//       if (dateRangeStr && dateRangeStr.includes(',')) {
//         const [startDate, endDate] = dateRangeStr.split(',').map(d => d.trim());
//         if (startDate && endDate) {
//           return { start_date: startDate, end_date: endDate };
//         }
//       }
//       // Fallback to default if parsing fails
//       const s = new Date(now);
//       s.setDate(s.getDate() - 15);
//       return { start_date: fmt(s), end_date: fmt(now) };
//     }

//     switch (selectedTimeFilter) {
//       case 'TDY':
//       case 't':
//         return { start_date: fmt(now), end_date: fmt(now) };
//       case 'YDY':
//       case '1d': {
//         const y = new Date(now);
//         y.setDate(y.getDate() - 1);
//         return { start_date: fmt(y), end_date: fmt(y) };
//       }
//       case '1W':
//       case '1w': {
//         const s = new Date(now);
//         s.setDate(s.getDate() - 7);
//         return { start_date: fmt(s), end_date: fmt(now) };
//       }
//       case '15D':
//       case '15d': {
//         const s = new Date(now);
//         s.setDate(s.getDate() - 15);
//         return { start_date: fmt(s), end_date: fmt(now) };
//       }
//       case '1M':
//       case '1m': {
//         const s = new Date(now);
//         s.setDate(s.getDate() - 30);
//         return { start_date: fmt(s), end_date: fmt(now) };
//       }
//       case '3M':
//       case '3m': {
//         const s = new Date(now);
//         s.setDate(s.getDate() - 90);
//         return { start_date: fmt(s), end_date: fmt(now) };
//       }
//       default: {
//         const s = new Date(now);
//         s.setDate(s.getDate() - 15);
//         return { start_date: fmt(s), end_date: fmt(now) };
//       }
//     }
//   }, [selectedTimeFilter]);

//   useEffect(() => {
//     const fetchPlantData = async () => {
//       try {
//         const zoneFilter = selectedZone ? [selectedZone] : [];
//         const payload = {
//           bu: selectedBu === 'SOD' ? 'TAS' : selectedBu,
//           zone: zoneFilter,
//           plant: []
//         };
//         const response = await apiClient.post('/api/indentdryout/get_distinct_location_details', payload);
//         if (response?.data?.status === true && response.data.data?.plant) {
//           const plants = response.data.data.plant.map((p: any) => ({
//             id: String(p.id || p.sap_id || ''),
//             name: p.name || p.location_name || ''
//           })).filter((p: any) => p.id && p.name);
//           setPlantData(plants);
//           plantDataRef.current = plants;
//           console.log('UnauthorisedFlow - Plant data loaded:', plants);
//         }
//       } catch (error) {
//         console.error("Error fetching plant data:", error);
//       }
//     };
//     fetchPlantData();
//   }, [selectedBu, selectedZone]);

//   const fetchData = useCallback(async () => {
//     try {
//       setIsLoading(true);
//       setError(null);
//       setSummaryCount(null);

//       const dateRange = getDateRange();
      
//       // Find plant name from plantDataRef
//       const selectedPlantObj = plantDataRef.current.find(p => p.id === selectedPlant);
//       const plantName = selectedPlantObj ? selectedPlantObj.name : (selectedPlant || "");
      
//       console.log('UnauthorisedFlow - Selected Plant ID:', selectedPlant);
//       console.log('UnauthorisedFlow - Plant Data:', plantDataRef.current);
//       console.log('UnauthorisedFlow - Found Plant:', selectedPlantObj);
//       console.log('UnauthorisedFlow - Using Plant Name:', plantName);
      
//       const payload = {
//         analytical_model: "Unauthorized Alerts",
//         start_date: dateRange.start_date,
//         end_date: dateRange.end_date,
//         location_name: plantName || "",
//         zone: selectedZone || "",
//         interlock_name: "",
//         alert_status: "",
//         alert_severity: [""],
//         equipment_type: "",
//         equipment_name: "",
//         download: ""
//       };
      
//       console.log('UnauthorisedFlow - API Payload:', payload);

//       const response = await apiClient.post('/api/tasanalytics/tas_analytics', payload);

//       if (response && response.data) {
//         let dataArray: UnauthorisedFlowData[] = [];

//         // Check if response has the summary format with top_10_locations
//         if (response.data.top_10_locations && Array.isArray(response.data.top_10_locations)) {
//           // Store the repeated count if available
//           if (response.data.repeated_unauthorized_flow_count !== undefined) {
//             setSummaryCount(response.data.repeated_unauthorized_flow_count);
//           }
          
//           // Use top_10_locations as the data array with rank
//           dataArray = response.data.top_10_locations.map((item: any, index: number) => ({
//             rank: index + 1,
//             ...item
//           }));
//         } else if (Array.isArray(response.data)) {
//           dataArray = response.data;
//         } else if (response.data.data && Array.isArray(response.data.data)) {
//           dataArray = response.data.data;
//         } else if (response.data.values && Array.isArray(response.data.values)) {
//           dataArray = response.data.values;
//         } else if (typeof response.data === 'object' && response.data !== null) {
//           dataArray = Object.values(response.data);
//         }

//         setData(dataArray);
//       } else {
//         setData([]);
//       }
//     } catch (err: any) {
//       console.error('Failed to fetch Unauthorized Alerts data:', err);
//       setError(err?.response?.data?.message || err.message || 'Failed to load data');
//       setData([]);
//     } finally {
//       setIsLoading(false);
//     }
//   }, [selectedZone, selectedPlant, getDateRange]);

//   useEffect(() => {
//     fetchData();
//   }, [fetchData, refreshKey]);



//   // Create and update pie chart
//   const createPieChart = useCallback((chartData: any[]) => {
//     if (!chartRef.current) return;

//     // Dispose existing root
//     if (rootRef.current) {
//       rootRef.current.dispose();
//     }

//     // Create root element
//     const root = am5.Root.new(chartRef.current);
//     rootRef.current = root;

//     // Set themes
//     root.setThemes([am5themes_Animated.new(root)]);

//     // Create chart
//     const chart = root.container.children.push(am5percent.PieChart.new(root, {
//       layout: root.verticalLayout,
//       innerRadius: am5.percent(30)
//     }));

//     // Create series
//     const series = chart.series.push(am5percent.PieSeries.new(root, {
//       valueField: 'count',
//       categoryField: 'location_name',
//       alignLabels: false
//     }));

//     // Configure slices
//     series.slices.template.setAll({
//       stroke: am5.color(0xffffff),
//       strokeWidth: 2,
//       strokeOpacity: 1,
//       templateField: 'settings'
//     });

//     // Configure labels
//     series.labels.template.setAll({
//       textType: 'circular',
//       centerX: 0,
//       centerY: 0,
//       text: '{category}: {value}',
//       fontSize: 12,
//       fill: am5.color(0x000000)
//     });

//     // Configure tooltips
//     series.slices.template.set('tooltipText', '{category}: {value}');

//     // Add click handler
//     series.slices.template.events.on('click', (ev) => {
//       const dataItem = ev.target.dataItem;
//       if (dataItem && dataItem.dataContext) {
//         setSelectedLocation(dataItem.dataContext as LocationData);
//         setDeviceModalOpen(true);
//       }
//     });

//     // Set data
//     series.data.setAll(chartData);

//     // Add legend
//     const legend = chart.children.push(am5.Legend.new(root, {
//       centerX: am5.percent(50),
//       x: am5.percent(50),
//       marginTop: 15,
//       marginBottom: 15,
//     }));

//     legend.data.setAll(series.dataItems);

//     // Add export menu
//     const exporting = am5plugins_exporting.Exporting.new(root, {
//       menu: am5plugins_exporting.ExportingMenu.new(root, {})
//     });

//     return root;
//   }, []);

//   // Update chart when data changes
//   useEffect(() => {
//     if (data.length > 0 && !isLoading) {
//       createPieChart(data);
//     }

//     return () => {
//       if (rootRef.current) {
//         rootRef.current.dispose();
//       }
//     };
//   }, [data, isLoading, createPieChart]);

//   return (
//     <div className="min-h-screen bg-gray-50 p-1">
//       <div className="max-w-[1920px] mx-auto space-y-1">
//       {/* Summary Count Display */}
//       {summaryCount !== null && !isLoading && (
//         <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
//           <p className="text-sm font-semibold text-blue-900">
//             Repeated Unauthorized Flow Count: <span className="text-lg">{summaryCount}</span>
//           </p>
//         </div>
//       )}

//       {/* Device Details Modal */}
//       <Dialog open={deviceModalOpen} onOpenChange={setDeviceModalOpen}>
//         <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
//           <DialogHeader>
//             <DialogTitle>Device Details - {selectedLocation?.location_name}</DialogTitle>
//           </DialogHeader>
//           {selectedLocation && selectedLocation.devices && (
//             <div className="mt-4">
//               <div className="border overflow-hidden shadow-md bg-white" style={{ borderColor: '#1e88e5' }}>
//                 <div className="overflow-x-auto overflow-y-auto max-h-[400px] relative">
//                   <table className="w-max min-w-full divide-y relative" style={{ '--divider-color': '#1e88e540' } as React.CSSProperties}>
//                     <thead className="sticky top-0 z-10" style={{ background: '#1e88e5' }}>
//                       <tr>
//                         <th className="px-6 py-3 text-left text-sm font-bold text-white uppercase tracking-wider whitespace-nowrap">
//                           Device Name
//                         </th>
//                         <th className="px-6 py-3 text-left text-sm font-bold text-white uppercase tracking-wider whitespace-nowrap">
//                           Count
//                         </th>
//                         <th className="px-6 py-3 text-left text-sm font-bold text-white uppercase tracking-wider whitespace-nowrap">
//                           Dates
//                         </th>
//                       </tr>
//                     </thead>
//                     <tbody className="bg-white" style={{ '--divider-color': '#1e88e540' } as React.CSSProperties}>
//                       {selectedLocation.devices.map((device: DeviceData, index: number) => (
//                         <tr
//                           key={index}
//                           className="transition-colors hover:[background-color:#1e88e510]"
//                           style={{ borderBottom: '1px solid #1e88e540' }}
//                         >
//                           <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
//                             {device.device_name}
//                           </td>
//                           <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
//                             {device.cnt}
//                           </td>
//                           <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
//                             {device.dates.join(', ')}
//                           </td>
//                         </tr>
//                       ))}
//                     </tbody>
//                   </table>
//                 </div>
//               </div>
//             </div>
//           )}
//         </DialogContent>
//       </Dialog>


//         {/* Pie Chart */}
//         <Card className="bg-white rounded-lg shadow-sm border space-y-0">
//           <CardHeader className="border-b p-2">
//             <CardTitle className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
//               Unauthorized Flow Distribution by Location
//             </CardTitle>
//           </CardHeader>
//           <CardContent className="p-1">
//             {isLoading ? (
//               <div className="flex items-center justify-center" style={{ height: '300px' }}>
//                 <div className="flex items-center justify-center gap-2">
//                   <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#1e88e5' }} />
//                   <span className="text-gray-500 font-medium">Loading chart data...</span>
//                 </div>
//               </div>
//             ) : data.length > 0 ? (
//               <div ref={chartRef} className="w-full h-96"></div>
//             ) : (
//               <div className="flex items-center justify-center" style={{ height: '300px' }}>
//                 <p className="text-gray-500 font-medium">No chart data available</p>
//               </div>
//             )}
//           </CardContent>
//         </Card>

//         {/* Error State */}
//         {error && !isLoading && (
//           <div className="text-center py-8">
//             <p className="text-red-600 text-sm font-medium">{error}</p>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default UnauthorisedFlow;
// import React, { useEffect, useState, useCallback, useRef } from 'react';
// import { apiClient } from '@/services/apiClient';
// import { Loader2, AlertCircle, Search, XCircle } from 'lucide-react';

// interface UnauthorisedFlowProps {
//   selectedBu: string;
//   selectedZone: string | null;
//   selectedPlant: string | null;
//   selectedTimeFilter: string | null | { key: string; cond: string; value: string };
//   refreshKey: number;
// }

// interface UnauthorisedFlowData {
//   [key: string]: any;
// }

// const UnauthorisedFlow: React.FC<UnauthorisedFlowProps> = ({
//   selectedBu,
//   selectedZone,
//   selectedPlant,
//   selectedTimeFilter,
//   refreshKey,
// }) => {
//   const [data, setData] = useState<UnauthorisedFlowData[]>([]);
//   const [isLoading, setIsLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [plantData, setPlantData] = useState<Array<{ id: string; name: string }>>([]);
//   const [searchTerm, setSearchTerm] = useState('');
//   const [summaryCount, setSummaryCount] = useState<number | null>(null);
//   const plantDataRef = useRef<Array<{ id: string; name: string }>>([]);

//   // Convert time filter to date range
//   const getDateRange = useCallback(() => {
//     const now = new Date();
//     const fmt = (d: Date) =>
//       `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

//     if (selectedTimeFilter && typeof selectedTimeFilter === 'object' && 'value' in selectedTimeFilter) {
//       // Custom date range - value format: "startDate,endDate"
//       const dateRangeStr = selectedTimeFilter.value;
//       if (dateRangeStr && dateRangeStr.includes(',')) {
//         const [startDate, endDate] = dateRangeStr.split(',').map(d => d.trim());
//         if (startDate && endDate) {
//           return { start_date: startDate, end_date: endDate };
//         }
//       }
//       // Fallback to default if parsing fails
//       const s = new Date(now);
//       s.setDate(s.getDate() - 15);
//       return { start_date: fmt(s), end_date: fmt(now) };
//     }

//     switch (selectedTimeFilter) {
//       case 'TDY':
//       case 't':
//         return { start_date: fmt(now), end_date: fmt(now) };
//       case 'YDY':
//       case '1d': {
//         const y = new Date(now);
//         y.setDate(y.getDate() - 1);
//         return { start_date: fmt(y), end_date: fmt(y) };
//       }
//       case '1W':
//       case '1w': {
//         const s = new Date(now);
//         s.setDate(s.getDate() - 7);
//         return { start_date: fmt(s), end_date: fmt(now) };
//       }
//       case '15D':
//       case '15d': {
//         const s = new Date(now);
//         s.setDate(s.getDate() - 15);
//         return { start_date: fmt(s), end_date: fmt(now) };
//       }
//       case '1M':
//       case '1m': {
//         const s = new Date(now);
//         s.setDate(s.getDate() - 30);
//         return { start_date: fmt(s), end_date: fmt(now) };
//       }
//       case '3M':
//       case '3m': {
//         const s = new Date(now);
//         s.setDate(s.getDate() - 90);
//         return { start_date: fmt(s), end_date: fmt(now) };
//       }
//       default: {
//         const s = new Date(now);
//         s.setDate(s.getDate() - 15);
//         return { start_date: fmt(s), end_date: fmt(now) };
//       }
//     }
//   }, [selectedTimeFilter]);

//   useEffect(() => {
//     const fetchPlantData = async () => {
//       try {
//         const zoneFilter = selectedZone ? [selectedZone] : [];
//         const payload = {
//           bu: selectedBu === 'SOD' ? 'TAS' : selectedBu,
//           zone: zoneFilter,
//           plant: []
//         };
//         const response = await apiClient.post('/api/indentdryout/get_distinct_location_details', payload);
//         if (response?.data?.status === true && response.data.data?.plant) {
//           const plants = response.data.data.plant.map((p: any) => ({
//             id: String(p.id || p.sap_id || ''),
//             name: p.name || p.location_name || ''
//           })).filter((p: any) => p.id && p.name);
//           setPlantData(plants);
//           plantDataRef.current = plants;
//           console.log('UnauthorisedFlow - Plant data loaded:', plants);
//         }
//       } catch (error) {
//         console.error("Error fetching plant data:", error);
//       }
//     };
//     fetchPlantData();
//   }, [selectedBu, selectedZone]);

//   const fetchData = useCallback(async () => {
//     try {
//       setIsLoading(true);
//       setError(null);
//       setSummaryCount(null);

//       const dateRange = getDateRange();
      
//       // Find plant name from plantDataRef
//       const selectedPlantObj = plantDataRef.current.find(p => p.id === selectedPlant);
//       const plantName = selectedPlantObj ? selectedPlantObj.name : (selectedPlant || "");
      
//       console.log('UnauthorisedFlow - Selected Plant ID:', selectedPlant);
//       console.log('UnauthorisedFlow - Plant Data:', plantDataRef.current);
//       console.log('UnauthorisedFlow - Found Plant:', selectedPlantObj);
//       console.log('UnauthorisedFlow - Using Plant Name:', plantName);
      
//       const payload = {
//         analytical_model: "Unauthorized Alerts",
//         start_date: dateRange.start_date,
//         end_date: dateRange.end_date,
//         location_name: plantName || "",
//         zone: selectedZone || "",
//         interlock_name: "",
//         alert_status: "",
//         alert_severity: [""],
//         equipment_type: "",
//         equipment_name: "",
//         download: ""
//       };
      
//       console.log('UnauthorisedFlow - API Payload:', payload);

//       const response = await apiClient.post('/api/tasanalytics/tas_analytics', payload);

//       if (response && response.data) {
//         let dataArray: UnauthorisedFlowData[] = [];

//         // Check if response has the summary format with top_10_locations
//         if (response.data.top_10_locations && Array.isArray(response.data.top_10_locations)) {
//           // Store the repeated count if available
//           if (response.data.repeated_unauthorized_flow_count !== undefined) {
//             setSummaryCount(response.data.repeated_unauthorized_flow_count);
//           }
          
//           // Use top_10_locations as the data array with rank
//           dataArray = response.data.top_10_locations.map((item: any, index: number) => ({
//             rank: index + 1,
//             ...item
//           }));
//         } else if (Array.isArray(response.data)) {
//           dataArray = response.data;
//         } else if (response.data.data && Array.isArray(response.data.data)) {
//           dataArray = response.data.data;
//         } else if (response.data.values && Array.isArray(response.data.values)) {
//           dataArray = response.data.values;
//         } else if (typeof response.data === 'object' && response.data !== null) {
//           dataArray = Object.values(response.data);
//         }

//         setData(dataArray);
//       } else {
//         setData([]);
//       }
//     } catch (err: any) {
//       console.error('Failed to fetch Unauthorized Alerts data:', err);
//       setError(err?.response?.data?.message || err.message || 'Failed to load data');
//       setData([]);
//     } finally {
//       setIsLoading(false);
//     }
//   }, [selectedZone, selectedPlant, getDateRange]);

//   useEffect(() => {
//     fetchData();
//   }, [fetchData, refreshKey]);

//   // Filter data based on search term
//   const filterData = (data: UnauthorisedFlowData[]) => {
//     if (!searchTerm.trim()) return data;

//     const searchLower = searchTerm.toLowerCase();
//     return data.filter(item => {
//       const searchableFields = Object.values(item)
//         .map(val => {
//           if (typeof val === 'object' && val !== null) {
//             return JSON.stringify(val);
//           }
//           return String(val || '');
//         })
//         .filter(Boolean);

//       return searchableFields.some(field =>
//         field.toString().toLowerCase().includes(searchLower)
//       );
//     });
//   };

//   const filteredData = filterData(data);

//   // Get table headers dynamically from data
//   const getTableHeaders = () => {
//     if (filteredData.length === 0) return [];
    
//     const firstItem = filteredData[0];
//     return Object.keys(firstItem).filter(key => {
//       // Filter out any internal/private keys if needed
//       return !key.startsWith('_');
//     });
//   };
//   const headers = getTableHeaders();

//   return (
//     <div className="w-full">
//       {/* Summary Count Display */}
//       {/* {summaryCount !== null && !isLoading && (
//         <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
//           <p className="text-sm font-semibold text-blue-900">
//             Repeated Unauthorized Flow Count: <span className="text-lg">{summaryCount}</span>
//           </p>
//         </div>
//       )} */}

//       {/* Search Bar */}
//       <div className="mt-4 mb-4 flex items-center gap-3">
//         <div className="relative flex-1">
//           <div className="absolute inset-y-0 left-0 pl-3 mt-1 flex items-center pointer-events-none">
//             <Search className="h-4 w-4 text-gray-400" />
//           </div>
//           <input
//             type="text"
//             value={searchTerm}
//             onChange={(e) => setSearchTerm(e.target.value)}
//             placeholder="Search..."
//             disabled={isLoading}
//             className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-gray-500 focus:border-gray-500 text-sm bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
//           />
//           {searchTerm && !isLoading && (
//             <button
//               type="button"
//               onClick={() => setSearchTerm("")}
//               className="absolute inset-y-0 right-0 pr-3 flex items-center hover:bg-gray-100 rounded-r-lg transition-colors"
//             >
//               <XCircle className="h-4 w-4 text-gray-400 hover:text-gray-600" />
//             </button>
//           )}
//         </div>
//       </div>

//       {/* Error State */}
//       {error && !isLoading && (
//         <div className="text-center py-8">
//           <p className="text-red-600 text-sm font-medium">{error}</p>
//         </div>
//       )}

//       {/* Table */}
//       {!error && (
//         <div className="border overflow-hidden shadow-md bg-white" style={{ borderColor: '#1e88e5' }}>
//           <div className="overflow-x-auto overflow-y-auto max-h-[500px] relative">
//             <table className="w-max min-w-full divide-y relative" style={{ '--divider-color': '#1e88e540' } as React.CSSProperties}>
//               <thead className="sticky top-0 z-10" style={{ background: '#1e88e5' }}>
//                 <tr>
//                   {headers.map((header) => (
//                     <th
//                       key={header}
//                       className="px-6 py-3 text-left text-sm font-bold text-white uppercase tracking-wider whitespace-nowrap"
//                     >
//                       {header.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
//                     </th>
//                   ))}
//                 </tr>
//               </thead>
//               <tbody className="bg-white" style={{ '--divider-color': '#1e88e540' } as React.CSSProperties}>
//                 {isLoading ? (
//                   <tr>
//                     <td colSpan={headers.length || 1} className="px-4 py-8 text-center">
//                       <div className="flex items-center justify-center gap-2">
//                         <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#1e88e5' }} />
//                         <span className="text-gray-500 font-medium">Loading Unauthorized Alerts data...</span>
//                       </div>
//                     </td>
//                   </tr>
//                 ) : filteredData.length > 0 ? (
//                   filteredData.map((item, index) => (
//                     <tr
//                       key={index}
//                       className="transition-colors hover:[background-color:#1e88e510]"
//                       style={{ borderBottom: '1px solid #1e88e540' }}
//                     >
//                       {headers.map((header) => {
//                         const value = item[header];
//                         let displayValue: React.ReactNode = '-';

//                         if (value !== null && value !== undefined) {
//                           if (typeof value === 'boolean') {
//                             displayValue = value ? 'Yes' : 'No';
//                           } else if (typeof value === 'object') {
//                             displayValue = JSON.stringify(value);
//                           } else if (typeof value === 'number') {
//                             displayValue = value.toLocaleString();
//                           } else {
//                             displayValue = String(value);
//                           }
//                         }

//                         return (
//                           <td key={header} className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
//                             {displayValue}
//                           </td>
//                         );
//                       })}
//                     </tr>
//                   ))
//                 ) : (
//                   <tr>
//                     <td colSpan={headers.length || 1} className="px-4 py-6 text-center">
//                       <p className="text-gray-600 font-medium">
//                         {data.length > 0 ? 'No data found matching your search' : 'No data available'}
//                       </p>
//                     </td>
//                   </tr>
//                 )}
//               </tbody>
//             </table>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default UnauthorisedFlow;
// export default UnauthorisedFlow;

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { apiClient } from '@/services/apiClient';
import { Loader2, AlertCircle, Search, XCircle } from 'lucide-react';
import * as am5 from '@amcharts/amcharts5';
import * as am5percent from '@amcharts/amcharts5/percent';
import * as am5plugins_exporting from '@amcharts/amcharts5/plugins/exporting';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { Card, CardHeader, CardTitle, CardContent } from '@/@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/@/components/ui/dialog';

interface UnauthorisedFlowProps {
  selectedBu: string;
  selectedZone: string | null;
  selectedPlant: string | null;
  selectedTimeFilter: string | null | { key: string; cond: string; value: string };
  refreshKey: number;
  plantData?: Array<{ id: string; name: string }>;
}
interface DeviceData {
  device_name: string;
  cnt: number;
  dates: string[];
}
interface UnauthorisedFlowData {
  [key: string]: any;
}

// Colors for zone/plant list (match pie chart order)
const ZONE_LIST_COLORS = [
  '#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626', '#4F46E5', '#E11D48', '#0D9488',
];

const UnauthorisedFlow: React.FC<UnauthorisedFlowProps> = ({
  selectedBu,
  selectedZone,
  selectedPlant,
  selectedTimeFilter,
  refreshKey,
  plantData: plantDataProp = [],
}) => {
  const [data, setData] = useState<UnauthorisedFlowData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plantData, setPlantData] = useState<Array<{ id: string; name: string }>>([]);
  const [summaryCount, setSummaryCount] = useState<number | null>(null);
  const plantDataRef = useRef<Array<{ id: string; name: string }>>([]);
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [zoneSummarySearchTerm, setZoneSummarySearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'zone' | 'plant'>('zone');
  const [apiResponseData, setApiResponseData] = useState<any>(null);
  const [locationsData, setLocationsData] = useState<any[]>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Convert time filter to date range
  const getDateRange = useCallback(() => {
    const now = new Date();
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (selectedTimeFilter && typeof selectedTimeFilter === 'object' && 'value' in selectedTimeFilter) {
      // Custom date range - value format: "startDate,endDate"
      const dateRangeStr = selectedTimeFilter.value;
      if (dateRangeStr && dateRangeStr.includes(',')) {
        const [startDate, endDate] = dateRangeStr.split(',').map(d => d.trim());
        if (startDate && endDate) {
          return { start_date: startDate, end_date: endDate };
        }
      }
      // Fallback to default if parsing fails
      const s = new Date(now);
      s.setDate(s.getDate() - 15);
      return { start_date: fmt(s), end_date: fmt(now) };
    }

    switch (selectedTimeFilter) {
      case 'TDY':
      case 't':
        return { start_date: fmt(now), end_date: fmt(now) };
      case 'YDY':
      case '1d': {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        return { start_date: fmt(y), end_date: fmt(y) };
      }
      case '1W':
      case '1w': {
        const s = new Date(now);
        s.setDate(s.getDate() - 7);
        return { start_date: fmt(s), end_date: fmt(now) };
      }
      case '15D':
      case '15d': {
        const s = new Date(now);
        s.setDate(s.getDate() - 15);
        return { start_date: fmt(s), end_date: fmt(now) };
      }
      case '1M':
      case '1m': {
        const s = new Date(now);
        s.setDate(s.getDate() - 30);
        return { start_date: fmt(s), end_date: fmt(now) };
      }
      case '3M':
      case '3m': {
        const s = new Date(now);
        s.setDate(s.getDate() - 90);
        return { start_date: fmt(s), end_date: fmt(now) };
      }
      default: {
        const s = new Date(now);
        s.setDate(s.getDate() - 15);
        return { start_date: fmt(s), end_date: fmt(now) };
      }
    }
  }, [selectedTimeFilter]);

  // Use plant data from parent (fetched once at dashboard level)
  useEffect(() => {
    setPlantData(plantDataProp);
    plantDataRef.current = plantDataProp;
  }, [plantDataProp]);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSummaryCount(null);

      const dateRange = getDateRange();
      
      // Find plant name from plantDataRef
      const selectedPlantObj = plantDataRef.current.find(p => p.id === selectedPlant);
      const plantName = selectedPlantObj ? selectedPlantObj.name : (selectedPlant || "");
      
      console.log('UnauthorisedFlow - Selected Plant ID:', selectedPlant);
      console.log('UnauthorisedFlow - Plant Data:', plantDataRef.current);
      console.log('UnauthorisedFlow - Found Plant:', selectedPlantObj);
      console.log('UnauthorisedFlow - Using Plant Name:', plantName);
      
      const payload = {
        analytical_model: "Unauthorized Alerts",
        start_date: dateRange.start_date,
        end_date: dateRange.end_date,
        location_name: plantName || "",
        zone: selectedZone || "",
        interlock_name: "",
        alert_status: "",
        alert_severity: [""],
        equipment_type: "",
        equipment_name: "",
        download: ""
      };
      
      console.log('UnauthorisedFlow - API Payload:', payload);

      const response = await apiClient.post('/api/tasanalytics/tas_analytics', payload);

      if (response && response.data) {
        let dataArray: UnauthorisedFlowData[] = [];
        let locations: any[] = [];

        // Check if response has the new format with locations array
        if (response.data.data && response.data.data.locations && Array.isArray(response.data.data.locations)) {
          // Store the full response data
          setApiResponseData(response.data.data);
          
          // Store the repeated count if available
          if (response.data.data.repeated_unauthorized_flow_count !== undefined) {
            setSummaryCount(response.data.data.repeated_unauthorized_flow_count);
          }
          
          // Store locations array
          locations = response.data.data.locations;
          setLocationsData(locations);
          
          // Use locations as the data array
          dataArray = locations.map((item: any, index: number) => ({
            rank: index + 1,
            ...item
          }));
        }
        // Check if response has the summary format with top_10_locations
        else if (response.data.top_10_locations && Array.isArray(response.data.top_10_locations)) {
          // Store the repeated count if available
          if (response.data.repeated_unauthorized_flow_count !== undefined) {
            setSummaryCount(response.data.repeated_unauthorized_flow_count);
          }
          
          // Use top_10_locations as the data array with rank
          dataArray = response.data.top_10_locations.map((item: any, index: number) => ({
            rank: index + 1,
            ...item
          }));
          setLocationsData(dataArray);
        } else if (Array.isArray(response.data)) {
          dataArray = response.data;
          setLocationsData(dataArray);
        } else if (response.data.data && Array.isArray(response.data.data)) {
          dataArray = response.data.data;
          setLocationsData(dataArray);
        } else if (response.data.values && Array.isArray(response.data.values)) {
          dataArray = response.data.values;
          setLocationsData(dataArray);
        } else if (typeof response.data === 'object' && response.data !== null) {
          dataArray = Object.values(response.data);
          setLocationsData(dataArray);
        }

        setData(dataArray);
      } else {
        setData([]);
        setLocationsData([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch Unauthorized Alerts data:', err);
      setError(err?.response?.data?.message || err.message || 'Failed to load data');
      setData([]);
      setLocationsData([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedZone, selectedPlant, getDateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  // Transform data based on view mode (zone or plant)
  const transformChartData = useCallback(() => {
    if (!locationsData || locationsData.length === 0) return [];

    if (viewMode === 'zone') {
      // Group by zone
      const zoneMap = new Map<string, number>();
      
      locationsData.forEach((location: any) => {
        const zone = location.zone || 'Unknown';
        const count = location.count || 0;
        zoneMap.set(zone, (zoneMap.get(zone) || 0) + count);
      });

      return Array.from(zoneMap.entries()).map(([zone, count]) => ({
        category: zone,
        count: count,
        location_name: zone,
        zone: zone
      }));
    } else {
      // Show by plant/location
      return locationsData.map((location: any) => ({
        category: location.location_name || 'Unknown',
        count: location.count || 0,
        location_name: location.location_name,
        zone: location.zone,
        devices: location.devices || [],
        deviceCount: (location.devices || []).length
      }));
    }
  }, [locationsData, viewMode]);

 
  const createPieChart = useCallback((chartData: any[]) => {
    if (!chartRef.current) return;
  
    if (rootRef.current) {
      rootRef.current.dispose();
    }
  
    const root = am5.Root.new(chartRef.current);
    rootRef.current = root;
  
    root.setThemes([am5themes_Animated.new(root)]);
    root._logo?.dispose();
  
    // Different color scheme (not copying from Alarms component)
    const GRADIENT_COLORS = [
      { light: "#60A5FA", dark: "#2563EB" }, // Blue
      { light: "#A78BFA", dark: "#7C3AED" }, // Purple
      { light: "#34D399", dark: "#059669" }, // Green
      { light: "#FBBF24", dark: "#D97706" }, // Amber
      { light: "#F87171", dark: "#DC2626" }, // Red
      { light: "#818CF8", dark: "#4F46E5" }, // Indigo
      { light: "#FB7185", dark: "#E11D48" }, // Rose
      { light: "#14B8A6", dark: "#0D9488" }, // Teal
    ];
  
    const chart = root.container.children.push(
      am5percent.PieChart.new(root, {
        layout: root.horizontalLayout,
        radius: am5.percent(90),
        paddingTop: 10,
        paddingRight: 10,
        paddingBottom: 10,
        paddingLeft: 10
      })
    );
  
    const series = chart.series.push(
      am5percent.PieSeries.new(root, {
        alignLabels: false,
        calculateAggregates: true,
        valueField: "count",
        categoryField: "category",
        innerRadius: am5.percent(20)
      })
    );
  
   
    series.slices.template.setAll({
      tooltipText: "{category}\ncount:{value}",
      stroke: am5.color(0xffffff),
      strokeWidth: 3,
      cornerRadius: 4,
      cursorOverStyle: "pointer",
    });
  
    series.slices.template.states.create("hover", {
      scale: 1.05,
    });
  
    /* ----- VARIABLE RADIUS ----- */
    series.slices.template.adapters.add("radius", function(radius, target) {
      const dataItem = target.dataItem;
      const high = series.getPrivate("valueHigh");
      
      if (dataItem && high) {
        const dataContext = dataItem.dataContext as any;
        const value = dataContext?.count || 0;
        const minRadius = 0.6;
        const radiusFactor = minRadius + (1 - minRadius) * (value / high);
        return radius * radiusFactor;
      }
      return radius;
    });
  
    // Hide labels and ticks
    series.labels.template.setAll({
      visible: false
    });
  
    series.ticks.template.setAll({
      visible: false
    });
  
    // Apply gradient fills to slices based on index
    series.slices.template.adapters.add("fillGradient", (fillGradient, target) => {
      const dataItem = target.dataItem as any;
      if (dataItem && root) {
        const index = series.dataItems.indexOf(dataItem);
        const gradientColor = GRADIENT_COLORS[index % GRADIENT_COLORS.length];
        
        return am5.LinearGradient.new(root, {
          stops: [
            { color: am5.color(gradientColor.light), offset: 0 },
            { color: am5.color(gradientColor.dark), offset: 1 }
          ]
        });
      }
      return fillGradient;
    });
  
    // Configure tooltip with dynamic color matching the slice
    const tooltip = am5.Tooltip.new(root, {
      getFillFromSprite: true,
      labelText: "{category}\ncount:{value}",
      paddingTop: 5,
      paddingBottom: 5,
      paddingLeft: 7,
      paddingRight: 7,
      dy: -20,
      centerX: am5.percent(50),
      animationDuration: 150
    });
  
    // Set small font size for tooltip text with black bold color
    tooltip.label.setAll({
      fontSize: 10,
      fill: am5.color(0x000000),
      fontWeight: "bold"
    });
  
    series.slices.template.set("tooltip", tooltip);
  
    // Apply gradient to tooltip background to match the slice
    series.slices.template.events.on("pointerover", (ev) => {
      const dataItem = ev.target.dataItem as any;
      const tooltip = ev.target.get("tooltip");
      if (dataItem && tooltip && root) {
        const index = series.dataItems.indexOf(dataItem);
        const gradientColor = GRADIENT_COLORS[index % GRADIENT_COLORS.length];
        
        // Set tooltip background to match slice gradient
        const background = tooltip.get("background");
        if (background) {
          background.setAll({
            fillGradient: am5.LinearGradient.new(root, {
              stops: [
                { color: am5.color(gradientColor.light), offset: 0 },
                { color: am5.color(gradientColor.dark), offset: 1 }
              ]
            }),
            stroke: am5.color(0xffffff),
            strokeWidth: 1,
            fillOpacity: 0.95
          });
        }
      }
    });
  
   
    series.slices.template.events.on("click", (ev) => {
      const data = ev.target.dataItem?.dataContext;
      if (data) {
        setSelectedLocation(data);
      }
    });
  
    series.data.setAll(chartData);
    series.appear(1000, 100);
    chart.appear(1000, 100);
  
  }, [viewMode]);
  
  // Reset selected location when view mode changes
  useEffect(() => {
    setSelectedLocation(null);
  }, [viewMode]);

  // Update chart when data changes (only when there is meaningful data with count > 0)
  useEffect(() => {
    const chartData = transformChartData();
    const meaningfulData = chartData.filter((d: any) => (d.count || 0) > 0);
    if (meaningfulData.length > 0 && !isLoading) {
      createPieChart(meaningfulData);
    }

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
      }
    };
  }, [locationsData, isLoading, viewMode, transformChartData, createPieChart]);

  const chartData = transformChartData();
  const hasMeaningfulData = chartData.length > 0 && chartData.some((d: any) => (d.count || 0) > 0);

  return (
    <div className="min-h-screen bg-gray-50 p-1">
      <div className="max-w-[1920px] mx-auto space-y-1">
  
        <Card className="bg-white rounded-lg shadow-sm border">
          <CardHeader className="border-b p-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Unauthorized Flow Distribution
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">View:</span>
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('zone')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      viewMode === 'zone'
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Zone
                  </button>
                  <button
                    onClick={() => setViewMode('plant')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      viewMode === 'plant'
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Plant
                  </button>
                </div>
              </div>
            </div>
          </CardHeader>
  
          <CardContent className="p-2 pb-2 pt-1">
            {isLoading ? (
              <div className="flex items-center justify-center h-[260px]">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : hasMeaningfulData ? (
              <div className="flex gap-4 h-[312px]">
                {/* Pie chart + zone list grouped together (close to each other) */}
                <div className="flex flex-[0.55] gap-2 items-stretch min-w-0">
                  {/* PIE CHART - Left (always visible, do not remove) */}
                  <div className="flex flex-col items-start flex-shrink-0 min-w-[340px] overflow-visible mt-2">
                    {!isLoading && hasMeaningfulData && (
                      <div className="text-[10px] text-gray-500 px-1 pb-1 shrink-0">
                        Click on slice to filter by {viewMode === 'zone' ? 'zone' : 'plant'}
                      </div>
                    )}
                    <div className="shrink-0 w-[340px] h-[340px] p-1 -mt-9">
                      <div ref={chartRef} className="w-full h-full min-w-[340px] min-h-[340px]" style={{ width: 340, height: 340 }} />
                    </div>
                  </div>

                  {/* ZONE/PLANT LIST - right next to pie chart (height matches Device Details table: header + 240px body) */}
                  <div className="flex flex-col min-w-0 overflow-hidden ml-2 h-[272px]">
                    <div className="flex flex-col gap-0.5 flex-1 overflow-y-auto px-2 mt-10 min-h-0">
                      {(() => {
                        const filteredData = chartData.filter((d: any) => (d.count || 0) > 0);
                        const totalCount = chartData.reduce((sum: number, d: any) => sum + (d.count || 0), 0);
                        if (filteredData.length === 0) {
                          return (
                            <div className="text-center text-gray-500 text-sm py-4">No data available</div>
                          );
                        }
                        return filteredData.map((item: any, index: number) => {
                          const color = ZONE_LIST_COLORS[index % ZONE_LIST_COLORS.length];
                          const count = item.count ?? 0;
                          const pct = totalCount > 0 ? (count / totalCount) * 100 : 0;
                          const label = item.category || item.location_name || 'Unknown';
                          const isSelected =
                            selectedLocation &&
                            (viewMode === 'zone'
                              ? (selectedLocation.zone === item.zone || selectedLocation.category === item.category)
                              : selectedLocation.location_name === item.location_name);
                          return (
                            <div
                              key={`${label}-${index}`}
                              className={`flex items-start gap-1.5 p-1.5 rounded-lg transition-colors duration-200 text-xs ${
                                isSelected ? 'bg-blue-50' : 'hover:bg-gray-50 cursor-pointer'
                              }`}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedLocation(null);
                                } else {
                                  setSelectedLocation(item);
                                }
                              }}
                            >
                              <div
                                className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5"
                                style={{ backgroundColor: color }}
                              />
                              <span
                                className="font-medium text-gray-700 min-w-0 w-[180px] max-w-[180px] truncate block"
                                title={label}
                              >
                                {label}
                              </span>
                              <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                                <div className="flex items-center gap-0.5">
                                  <span
                                    className="font-semibold text-xs"
                                    style={{ color }}
                                  >
                                    {count}
                                  </span>
                                  <span className="text-gray-400 text-xs">counts</span>
                                </div>
                                <div className="h-1 rounded-full bg-gray-100 overflow-hidden w-14">
                                  <div
                                    className="h-full rounded-full transition-all duration-300"
                                    style={{
                                      backgroundColor: color,
                                      width: `${pct}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
  
                {/* DETAILS PANEL - Right side, shows all devices or filtered by selection */}
                <div className="flex-[0.5] h-full flex flex-col min-w-0">
                  {/* Selection Header - matches Bay Reassignment */}
                  {selectedLocation && (
                    <div className="mb-3 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                      <div className="text-xs text-gray-700">
                        Filtered by {viewMode}: <span className="font-medium text-blue-600">{viewMode === 'zone' ? selectedLocation.category || selectedLocation.zone : selectedLocation.location_name}</span>
                      </div>
                      <button
                        onClick={() => setSelectedLocation(null)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
                        title="Clear filter"
                      >
                        Clear Filter
                      </button>
                    </div>
                  )}
                  
                  {/* Device Details Table */}
                  <div className="border overflow-hidden bg-white rounded-lg" style={{ borderColor: '#1e88e5' }}>
                    <div className="px-3 py-2 text-xs font-semibold text-white shrink-0" style={{ background: '#1e88e5' }}>
                      Device Details
                    </div>
                    <div className="overflow-y-auto flex-1 max-h-[270px]">
                      <table className="w-full text-xs border-collapse">
                        <thead className="sticky top-0 bg-gray-100">
                          <tr>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b">Device Name</th>
                            <th className="px-2 py-1.5 text-center font-semibold text-gray-700 border-b">Count</th>
                            <th className="px-2 py-1.5 text-center font-semibold text-gray-700 border-b">Dates</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            let allDevices: any[] = [];
                            
                            if (selectedLocation) {
                              if (viewMode === 'zone') {
                                // Filter devices by selected zone
                                const selectedZone = selectedLocation.zone || selectedLocation.category;
                                allDevices = locationsData.flatMap((location: any) => {
                                  if (location.zone === selectedZone && location.devices && Array.isArray(location.devices)) {
                                    return location.devices.map((device: DeviceData) => ({
                                      location_name: location.location_name,
                                      zone: location.zone,
                                      ...device
                                    }));
                                  }
                                  return [];
                                });
                              } else {
                                // Show devices for selected location only
                                allDevices = (selectedLocation.devices || []).map((device: DeviceData) => ({
                                  location_name: selectedLocation.location_name,
                                  zone: selectedLocation.zone,
                                  ...device
                                }));
                              }
                            } else {
                              // Show all devices from all locations
                              allDevices = locationsData.flatMap((location: any) => {
                                if (location.devices && Array.isArray(location.devices)) {
                                  return location.devices.map((device: DeviceData) => ({
                                    location_name: location.location_name,
                                    zone: location.zone,
                                    ...device
                                  }));
                                }
                                return [];
                              });
                            }
                            
                            if (allDevices.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={3} className="px-4 py-8 text-center">
                                    <p className="text-gray-500">No device data available</p>
                                  </td>
                                </tr>
                              );
                            }
                            
                            return allDevices.map((item: any, index: number) => (
                              <tr key={`${item.location_name}-${item.device_name}-${index}`} className="border-b border-gray-100 hover:bg-blue-50/50">
                                <td className="px-2 py-1.5 text-gray-800">{item.device_name}</td>
                                <td className="px-2 py-1.5 text-center text-gray-800">{item.cnt}</td>
                                <td className="px-2 py-1.5 text-center text-gray-800 text-xs">{item.dates?.join(", ") || "-"}</td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[260px]">
                <p className="text-gray-500 font-medium">No data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Table */}
        {!error && (
          <Card className="bg-white rounded-lg shadow-sm border">
                      <CardHeader className="border-b p-2 flex flex-row items-center justify-between gap-3">

              <CardTitle className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {/* {viewMode === 'zone' ? 'Zone Summary' : 'Location Summary'} */}
                Unauthorized Flow Distribution Summary
              </CardTitle>
              <div className="relative shrink-0 w-80 min-w-0">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={zoneSummarySearchTerm}
                    onChange={(e) => setZoneSummarySearchTerm(e.target.value)}
                    placeholder="Search..."
                    className="block w-full pl-8 pr-8 py-1.5 border border-gray-300 rounded-lg focus:ring-gray-500 focus:border-gray-500 text-sm bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  {zoneSummarySearchTerm && (
                    <button
                      type="button"
                      onClick={() => setZoneSummarySearchTerm("")}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center hover:bg-gray-100 rounded-r-lg transition-colors"
                    >
                      <XCircle className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                    </button>
                  )}
                </div>
            
            </CardHeader>
            <CardContent className="p-2 pb-2 pt-1">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  <span className="text-sm text-gray-500 font-medium">Loading summary...</span>
                </div>
              ) : !hasMeaningfulData ? (
                <div className="border overflow-hidden bg-white" style={{ borderColor: '#1e88e5' }}>
                  <div className="overflow-x-auto overflow-y-auto max-h-[500px] relative">
                    <table className="w-max min-w-full divide-y relative" style={{ '--divider-color': '#1e88e5' } as React.CSSProperties}>
                      <thead className="sticky top-0 z-10" style={{ background: '#1e88e5' }}>
                        <tr>
                          <th className="px-6 py-3 text-left text-sm font-bold text-white uppercase tracking-wider whitespace-nowrap">
                            Location Name
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-bold text-white uppercase tracking-wider whitespace-nowrap">
                            Zone
                          </th>
                          <th className="px-6 py-3 text-center text-sm font-bold text-white uppercase tracking-wider whitespace-nowrap">
                            Count
                          </th>
                          <th className="px-6 py-3 text-center text-sm font-bold text-white uppercase tracking-wider whitespace-nowrap">
                            Devices
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white" style={{ '--divider-color': '#1e88e540' } as React.CSSProperties}>
                        <tr>
                          <td colSpan={4} className="p-0 align-top">
                            <div className="flex items-center justify-center h-full min-h-[200px] p-8">
                              <p className="text-gray-500">No data available</p>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <>
              {/* Search Bar for Zone Summary Table */}
            

              <div className="border overflow-hidden bg-white" style={{ borderColor: '#1e88e5' }}>
                <div className="overflow-x-auto overflow-y-auto max-h-[500px] relative">
                  <table className="w-max min-w-full divide-y relative table-fixed" style={{ '--divider-color': '#1e88e5' } as React.CSSProperties}>
                    <thead className="sticky top-0 z-10" style={{ background: '#1e88e5' }}>
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-bold text-white uppercase tracking-wider whitespace-nowrap w-[28%]">
                          Location Name
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-bold text-white uppercase tracking-wider whitespace-nowrap w-[28%]">
                          Zone
                        </th>
                        <th className="px-6 py-3 text-center text-sm font-bold text-white uppercase tracking-wider whitespace-nowrap w-[22%]">
                          Count
                        </th>
                        <th className="px-6 py-3 text-center text-sm font-bold text-white uppercase tracking-wider whitespace-nowrap w-[22%]">
                          Devices
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white" style={{ '--divider-color': '#1e88e540' } as React.CSSProperties}>
                      {(() => {
                        // Filter locationsData based on search term
                        let filteredLocations = locationsData;
                        
                        if (zoneSummarySearchTerm.trim()) {
                          const searchLower = zoneSummarySearchTerm.toLowerCase();
                          filteredLocations = locationsData.filter((item: any) => {
                            const locationMatch = item.location_name?.toLowerCase().includes(searchLower);
                            const zoneMatch = item.zone?.toLowerCase().includes(searchLower);
                            const countMatch = String(item.count || '').includes(zoneSummarySearchTerm);
                            const deviceCountMatch = String((item.devices || []).length).includes(zoneSummarySearchTerm);
                            
                            // Search within device names
                            const deviceNameMatch = (item.devices || []).some((device: DeviceData) => 
                              device.device_name?.toLowerCase().includes(searchLower)
                            );
                            
                            // Search within device dates
                            const deviceDateMatch = (item.devices || []).some((device: DeviceData) => 
                              device.dates?.some((date: string) => date.toLowerCase().includes(searchLower)) ||
                              device.dates?.join(", ").toLowerCase().includes(searchLower)
                            );
                            
                            return locationMatch || zoneMatch || countMatch || deviceCountMatch || deviceNameMatch || deviceDateMatch;
                          });
                        }
                        
                        if (filteredLocations.length === 0) {
                          return (
                            <tr key="no-data">
                              <td colSpan={4} className="px-4 py-6 text-center">
                                <p className="text-gray-600 font-medium">
                                  {zoneSummarySearchTerm ? 'No data found matching your search' : 'No data available'}
                                </p>
                              </td>
                            </tr>
                          );
                        }
                        
                        return filteredLocations.map((item: any, index: number) => {
                        const rowKey = `${item.location_name || item.category}-${index}`;
                        const isExpanded = expandedRow === rowKey;
                        const deviceCount = (item.devices || []).length;
                        
                        return (
                          <>
                            <tr
                              key={index}
                              className="transition-colors hover:[background-color:#1e88e510] cursor-pointer"
                              style={{ borderBottom: '1px solid #1e88e540' }}
                              onClick={() => {
                                if (deviceCount > 0) {
                                  setExpandedRow(isExpanded ? null : rowKey);
                                }
                              }}
                            >
                              <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap w-[28%] min-w-0 overflow-hidden">
                                <span className="flex items-center gap-2 min-w-0">
                                  {deviceCount > 0 && (
                                    <span className="text-blue-600 font-bold flex-shrink-0">
                                      {isExpanded ? '▼' : '▶'}
                                    </span>
                                  )}
                                  <span className="min-w-0 truncate" title={item.location_name || '-'}>{item.location_name || '-'}</span>
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap w-[28%] min-w-0 overflow-hidden">
                                <span className="block min-w-0 truncate" title={item.zone || '-'}>{item.zone || '-'}</span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap text-center w-[22%]">
                                {item.count || 0}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap text-center w-[22%]">
                                {deviceCount}
                              </td>
                            </tr>
                            {/* Expanded device details row */}
                            {isExpanded && item.devices && item.devices.length > 0 && (() => {
                              // Filter devices based on search term
                              let filteredDevices = item.devices;
                              if (zoneSummarySearchTerm.trim()) {
                                const searchLower = zoneSummarySearchTerm.toLowerCase();
                                filteredDevices = item.devices.filter((device: DeviceData) => {
                                  const deviceNameMatch = device.device_name?.toLowerCase().includes(searchLower);
                                  const deviceDateMatch = device.dates?.some((date: string) => 
                                    date.toLowerCase().includes(searchLower)
                                  ) || device.dates?.join(", ").toLowerCase().includes(searchLower);
                                  const deviceCountMatch = String(device.cnt || '').includes(zoneSummarySearchTerm);
                                  
                                  return deviceNameMatch || deviceDateMatch || deviceCountMatch;
                                });
                              }
                              
                              if (filteredDevices.length === 0) {
                                return null;
                              }
                              
                              return (
                                <tr key={`${rowKey}-expanded`}>
                                  <td colSpan={4} className="px-4 py-3 bg-gray-50">
                                    <div className="ml-8">
                                      {/* <div className="text-xs font-semibold text-gray-600 mb-2 uppercase">Device Details</div> */}
                                      <div className="border rounded-lg overflow-hidden">
                                        <table className="w-full text-sm">
                                          <thead className="bg-gray-200">
                                            <tr>
                                              <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase">Device Name</th>
                                              <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 uppercase">Count</th>
                                              <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 uppercase">Dates</th>
                                            </tr>
                                          </thead>
                                          <tbody className="bg-white">
                                            {filteredDevices.map((device: DeviceData, deviceIndex: number) => (
                                              <tr key={deviceIndex} className="border-b border-gray-200">
                                                <td className="px-4 py-2 text-gray-700">{device.device_name}</td>
                                                <td className="px-4 py-2 text-gray-700 text-center">{device.cnt}</td>
                                                <td className="px-4 py-2 text-gray-700 text-center text-xs">{device.dates?.join(', ') || '-'}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })()}
                          </>
                        );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
        {/* Error State */}
        {error && !isLoading && (
          <div className="text-center py-8">
            <p className="text-red-600 text-sm font-medium">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
export default UnauthorisedFlow;