// import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
// } from '@/@/components/ui/dialog';
// import { Button } from '@/@/components/ui/button';
// import { Input } from '@/@/components/ui/input';
// import { Users, RefreshCw, Loader2, AlertTriangle, Download } from 'lucide-react';
// import { apiClient } from '../../../../services/apiClient';
// import { AgGridReact } from 'ag-grid-react';
// import { ColDef } from 'ag-grid-community';
// import 'ag-grid-community/styles/ag-grid.css';
// import 'ag-grid-community/styles/ag-theme-alpine.css';
// import { toast } from 'sonner';
// import * as XLSX from 'xlsx';
// import dayjs from 'dayjs';
// import clsx from 'clsx';

// interface OfficerData {
//   username?: string;
//   first_name?: string;
//   last_name?: string;
//   novex_role?: string[];
//   contact_number?: string;
//   sap_id?: string;
// }

// interface OfficerDialogProps {
//   open: boolean;
//   onOpenChange: (open: boolean) => void;
//   location: {
//     sap_id?: string;
//     location_name?: string;
//     name?: string;
//     sbu?: string;
//   } | null;
// }

// const OfficerDialog: React.FC<OfficerDialogProps> = ({
//   open,
//   onOpenChange,
//   location,
// }) => {
//   const [officerData, setOfficerData] = useState<OfficerData[]>([]);
//   const [isLoading, setIsLoading] = useState(false);
//   const [searchQuery, setSearchQuery] = useState('');
//   const [isDownloading, setIsDownloading] = useState(false);
//   const [rotating, setRotating] = useState(false);
//   const gridRef = useRef<AgGridReact>(null);

//   // Fetch officer data when dialog opens
//   useEffect(() => {
//     if (!open || !location?.sap_id || !location?.sbu) {
//       setOfficerData([]);
//       return;
//     }

//     const fetchOfficerData = async () => {
//       setIsLoading(true);
//       try {
//         const payload = {
//           sbu: location.sbu || 'SOD',
//           sap_id: location.sap_id,
//         };

//         const response = await apiClient.post('/api/sodinfra/get_sales_officer_infra', payload);
//         const data = response.data?.data || response.data || [];
//         setOfficerData(Array.isArray(data) ? data : []);
//       } catch (error) {
//         console.error('Error fetching officer data:', error);
//         setOfficerData([]);
//       } finally {
//         setIsLoading(false);
//       }
//     };

//     fetchOfficerData();
//   }, [open, location]);

//   // Auto-size columns when data loads
//   useEffect(() => {
//     if (officerData.length > 0 && gridRef.current?.api) {
//       setTimeout(() => {
//         gridRef.current?.api.autoSizeAllColumns();
//         gridRef.current?.api.sizeColumnsToFit();
//       }, 100);
//     }
//   }, [officerData]);

//   // Column definitions for AG Grid
//   const columnDefs = useMemo<ColDef[]>(() => {
//     if (!officerData || officerData.length === 0) return [];

//     return [
//       {
//         field: 'name',
//         headerName: 'NAME',
//         sortable: true,
//         resizable: true,
//         filter: false,
//         flex: 2,
//         minWidth: 10,
//         cellStyle: { textAlign: 'center', fontSize: '12px' },
//         headerStyle: { textAlign: 'left' },
//         valueGetter: (params) => {
//           const first = params.data?.first_name || '';
//           const last = params.data?.last_name || '';
//           return `${first} ${last}`.trim() || '-';
//         },
//       },
//       {
//         field: 'username',
//         headerName: 'USER ID',
//         sortable: true,
//         resizable: true,
//         filter: false,
//         flex: 1,
//         minWidth: 10,
//         cellStyle: { textAlign: 'center', fontSize: '12px' },
//         headerStyle: { textAlign: 'center' },
//         valueFormatter: (params) => params.value || '-',
//       },
//       {
//         field: 'novex_role',
//         headerName: 'ROLES',
//         sortable: true,
//         resizable: true,
//         filter: false,
//         flex: 1,
//         minWidth: 700,
//         cellStyle: { textAlign: 'center', fontSize: '12px' },
//         headerStyle: { textAlign: 'center' },
//         valueFormatter: (params) => {
//           if (Array.isArray(params.value) && params.value.length > 0) {
//             return params.value.join(', ');
//           }
//           return '-';
//         },
//       },
//       {
//         field: 'contact_number',
//         headerName: 'CONTACT',
//         sortable: true,
//         resizable: true,
//         filter: false,
//         flex: 1,
//         minWidth: 130,
//         cellStyle: { textAlign: 'center', fontSize: '12px' },
//         headerStyle: { textAlign: 'center' },
//         valueFormatter: (params) => params.value || '-',
//       },
//     ];
//   }, [officerData]);

//   const defaultColDef = useMemo(() => ({
//     sortable: true,
//     resizable: true,
//     enableCellTextSelection: true,
//     suppressMovable: false,
//     cellStyle: { fontSize: '12px' },
//   }), []);

//   // Download Excel function
//   const downloadExcel = useCallback(async () => {
//     if (!location?.sap_id || officerData.length === 0) {
//       toast.error('No data available to download');
//       return;
//     }

//     setIsDownloading(true);
//     try {
//       const formattedData = officerData.map(officer => ({
//         'Name': `${officer.first_name || ''} ${officer.last_name || ''}`.trim() || '-',
//         'User ID': officer.username || '-',
//         'Roles': Array.isArray(officer.novex_role) && officer.novex_role.length > 0 
//           ? officer.novex_role.join(', ') 
//           : '-',
//         'Contact': officer.contact_number || '-',
//       }));

//       const worksheet = XLSX.utils.json_to_sheet(formattedData);
//       const workbook = XLSX.utils.book_new();
//       XLSX.utils.book_append_sheet(workbook, worksheet, 'Plant Officers');

//       const locationName = location.location_name || location.name || 'Location';
//       const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
//       const filename = `Plant_Officers_${locationName}_${timestamp}.xlsx`;

//       XLSX.writeFile(workbook, filename);
//       toast.success('Excel file downloaded successfully');
//     } catch (error) {
//       console.error('Error downloading Excel:', error);
//       toast.error('Failed to download Excel file');
//     } finally {
//       setIsDownloading(false);
//     }
//   }, [location, officerData]);

//   // Refresh function
//   const handleRefresh = useCallback(async () => {
//     if (!location?.sap_id || !location?.sbu) return;

//     setRotating(true);
//     setIsLoading(true);
//     try {
//       const payload = {
//         sbu: location.sbu || 'SOD',
//         sap_id: location.sap_id,
//       };

//       const response = await apiClient.post('/api/sodinfra/get_sales_officer_infra', payload);
//       const data = response.data?.data || response.data || [];
//       setOfficerData(Array.isArray(data) ? data : []);
//       toast.success('Data refreshed successfully');
//     } catch (error) {
//       console.error('Error refreshing officer data:', error);
//       toast.error('Failed to refresh data');
//     } finally {
//       setIsLoading(false);
//       setTimeout(() => setRotating(false), 600);
//     }
//   }, [location]);

//   if (!location) return null;

//   const locationName = location.location_name || location.name || 'Location';
//   const locationDisplay = `HPCL, ${locationName}`;

//   return (
//     <Dialog open={open} onOpenChange={onOpenChange}>
//       <DialogContent className="sm:max-w-[170vw] w-[98vw] h-[80vh] p-0 gap-0 bg-white">
//         <DialogHeader className="px-3 pt-1 pb-0 bg-white mb-0">
//           <div className="flex items-center justify-between mb-0">
//             <div className="flex items-center gap-2">
//               <div className="p-1.5 bg-gray-100 rounded-lg">
//                 <Users className="w-4 h-4 text-gray-600" />
//               </div>
//               <div>
//                 <DialogTitle className="text-lg font-bold text-gray-900 whitespace-nowrap mb-0">
//                   Plant Officers ({locationDisplay})
//                 </DialogTitle>
//               </div>
//             </div>
//           </div>
//         </DialogHeader>

//         <div className="flex-1 overflow-hidden mt-3 flex flex-col bg-white px-4">
//           {/* Search, Download and Refresh Bar */}
//           <div className="flex justify-between items-center mb-1 space-x-2 py-1">
//             <div className="flex-grow">
//               <Input
//                 placeholder="Search table..."
//                 value={searchQuery}
//                 onChange={(e) => setSearchQuery(e.target.value)}
//                 className="w-full h-8"
//               />
//             </div>

//             <Button
//               variant="outline"
//               size="sm"
//               onClick={downloadExcel}
//               disabled={isDownloading || isLoading || officerData.length === 0}
//             >
//               <Download className={clsx("mr-2 h-4 w-4", { "animate-spin": isDownloading })} />
//               {isDownloading ? 'Downloading...' : 'Download'}
//             </Button>

//             <Button
//               variant="outline"
//               size="sm"
//               onClick={handleRefresh}
//               disabled={isLoading}
//             >
//               <RefreshCw
//                 className={clsx("mr-2 h-4 w-4", { "animate-spin": rotating })}
//               />
//               Refresh
//             </Button>
//           </div>

//           {/* AG Grid Table */}
//           <div className="flex-1 overflow-hidden pb-4">
//             {isLoading ? (
//               <div className="flex flex-col items-center justify-center h-full bg-white rounded-lg border border-gray-200">
//                 <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
//                 <span className="text-sm font-medium text-gray-700">Loading officer data...</span>
//               </div>
//             ) : officerData.length === 0 ? (
//               <div className="flex flex-col items-center justify-center h-full bg-white rounded-lg border border-gray-200">
//                 <div className="text-center">
//                   <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
//                     <AlertTriangle className="w-8 h-8 text-gray-400" />
//                   </div>
//                   <h3 className="text-lg font-semibold text-gray-900 mb-2">No Data Available</h3>
//                   <p className="text-sm text-gray-500 mb-4">
//                     There is no officer data available for this location.
//                   </p>
//                 </div>
//               </div>
//             ) : (
//               <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
//                 <style>{`
//                   .ag-theme-alpine .ag-header-cell-label {
//                     justify-content: center;
//                     text-align: center;
//                   }
//                   .ag-theme-alpine .ag-header-cell-text {
//                     text-align: center;
//                     width: 100%;
//                   }
//                   .ag-theme-alpine .ag-cell {
//                     padding-left: 8px;
//                     padding-right: 8px;
//                   }
//                   .ag-theme-alpine .ag-header-cell {
//                     padding-left: 8px;
//                     padding-right: 8px;
//                     background-color:rgb(55, 108, 223) !important;
//                     color: white !important;
//                   }
//                   .ag-theme-alpine .ag-header {
//                     background-color:rgb(55, 108, 223) !important;
//                   }
//                   .ag-theme-alpine .ag-row {
//                     border-bottom-width: 0.5px;
//                   }
//                 `}</style>
//                 <div style={{ height: '500px', width: '100%' }}>
//                   {columnDefs.length > 0 ? (
//                     <div className="ag-theme-alpine" style={{ height: '100%', width: '100%', userSelect: 'text', WebkitUserSelect: 'text' }}>
//                       <AgGridReact
//                         ref={gridRef}
//                         rowData={officerData}
//                         columnDefs={columnDefs}
//                         defaultColDef={defaultColDef}
//                         pagination={true}
//                         paginationPageSize={50}
//                         paginationPageSizeSelector={[10, 20, 50, 100]}
//                         animateRows={false}
//                         suppressRowClickSelection={true}
//                         suppressCellFocus={true}
//                         suppressScrollOnNewData={true}
//                         enableRangeSelection={true}
//                         enableCellTextSelection={true}
//                         ensureDomOrder={true}
//                         quickFilterText={searchQuery}
//                         rowBuffer={20}
//                         debounceVerticalScrollbar={true}
//                         suppressAggFuncInHeader={true}
//                         suppressMenuHide={true}
//                         rowHeight={36}
//                         headerHeight={36}
//                       />
//                     </div>
//                   ) : (
//                     <div className="flex flex-col items-center justify-center h-full text-gray-500">
//                       <AlertTriangle className="w-10 h-10 mb-2" />
//                       <span className="text-sm font-medium">
//                         No table data available
//                       </span>
//                     </div>
//                   )}
//                 </div>
//               </div>
//             )}
//           </div>
//         </div>
//       </DialogContent>
//     </Dialog>
//   );
// };

// export default OfficerDialog;
