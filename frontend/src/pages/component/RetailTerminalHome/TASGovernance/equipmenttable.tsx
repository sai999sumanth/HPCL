// import React, { useState, useEffect } from 'react';
// import { ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
// import { apiClient } from '@/services/apiClient';

// interface EquipmentTableProps {
//   startDate?: string;
//   endDate?: string;
//   refreshTrigger?: number;
// }

// const Table = ({ startDate, endDate, refreshTrigger = 0 }: EquipmentTableProps = {}) => {
//   const [data, setData] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [expandedRow, setExpandedRow] = useState(null);
//   const [selectedEquipment, setSelectedEquipment] = useState('ESD');
//   const [selectedDevice, setSelectedDevice] = useState(null); // { sapId, detailIndex }

//   useEffect(() => {
//     fetchData();
//   }, [startDate, endDate, refreshTrigger, selectedEquipment]);

//   // Get dynamic barrier gate headers from API data
//   const getBarrierGateHeaders = () => {
//     if (!data || data.length === 0) return [];

//     const firstItem = data[0];
//     const excludeKeys = [
//       'sap_id',
//       'location_name',
//       'equipment_type',
//       // Dynamic activated fields for all equipment types
//       'no_of_esd_activated', 'esd_activated_details',
//       'no_of_vft_activated', 'vft_activated_details',
//       'no_of_radar_activated', 'radar_activated_details',
//       'no_of_bcu_activated', 'bcu_activated_details',
//       'no_of_fire_effect_activated', 'fire_effect_activated_details'
//     ];

//     return Object.keys(firstItem).filter(key => !excludeKeys.includes(key));
//   };

//   const barrierGateHeaders = getBarrierGateHeaders();

//   const fetchData = async () => {
//     setLoading(true);
//     setError(null);

//     try {
//       const payload = {
//         analytical_model: "Equipment Location Wise Count",
//         location_name: "",
//         interlock_name: "",
//         alert_status: "",
//         alert_severity: [],
//         zone: "",
//         start_date: startDate || new Date().toISOString().split('T')[0],
//         end_date: endDate || new Date().toISOString().split('T')[0],
//         equipment_type: "", // Initially present, later removed
//         equipment_name: "ESD", // Initially hardcoded, later dynamic
//         download: "",
//         top_n: 0
//       };

//       const response = await apiClient.post('/api/tasanalytics/tas_analytics', payload);
//       setData(response.data || []);
//     } catch (err) {
//       setError(err.message || 'Failed to fetch data');
//       setData([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const toggleRow = (sapId) => {
//     const newExpandedRow = expandedRow === sapId ? null : sapId;
//     setExpandedRow(newExpandedRow);
//     // Clear selected device when collapsing
//     if (newExpandedRow === null) {
//       setSelectedDevice(null);
//     }
//   };

//   const handleDeviceClick = (sapId, detailIndex) => {
//     // Toggle selection - if same device clicked, deselect it
//     if (selectedDevice && selectedDevice.sapId === sapId && selectedDevice.detailIndex === detailIndex) {
//       setSelectedDevice(null);
//     } else {
//       setSelectedDevice({ sapId, detailIndex });
//     }
//   };

//   // Get counts for main table - either from selected device or aggregated
//   const getMainTableCounts = (row, header) => {
//     // If a device is selected for this row, use that device's counts
//     if (selectedDevice && selectedDevice.sapId === row.sap_id) {
//       const { detailsField } = getEquipmentFields();
//       const details = row[detailsField] || [];
//       const detail = details[selectedDevice.detailIndex];
//       if (detail && detail[header] && detail[header].length > 0) {
//         return {
//           success: detail[header][0]?.success || 0,
//           failed: detail[header][0]?.failed || 0
//         };
//       }
//     }
//     // Otherwise, use aggregated counts from main row
//     return {
//       success: row[header]?.[0]?.success || 0,
//       failed: row[header]?.[0]?.failed || 0
//     };
//   };

//   const getEquipmentFields = () => {
//     const equipmentType = selectedEquipment.toLowerCase();
//     return {
//       countField: `no_of_${equipmentType}_activated`,
//       detailsField: `${equipmentType}_activated_details`
//     };
//   };

//   if (loading) {
//     return (
//       <div className="flex items-center justify-center p-8">
//         <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
//         <span className="ml-2 text-sm text-gray-600">Loading...</span>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div className="text-center p-8 text-red-500">
//         <p>Error: {error}</p>
//       </div>
//     );
//   }

//   return (
//     <div className="w-full">
//           {/* Header */}
//       <div className="mb-2 flex items-center justify-between">
//         <h4 className="text-sm font-semibold text-gray-800">Location Wise Count</h4>
//         <div className="flex items-center gap-2">
//           <label htmlFor="equipment-select" className="text-xs text-gray-600">Equipment Type:</label>
//           <select
//             id="equipment-select"
//             value={selectedEquipment}
//             onChange={(e) => setSelectedEquipment(e.target.value)}
//             className="px-2 py-1 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
//           >
//             <option value="ESD">ESD</option>
//             <option value="VFT">VFT</option>
//             <option value="RADAR">RADAR</option>
//             <option value="BCU">BCU</option>
//             <option value="FIRE EFFECT">FIRE EFFECT</option>
//           </select>
//         </div>
//           </div>

//           {/* Table Container */}
//       <div className="border border-gray-300 rounded-lg overflow-hidden">
//         <div className="overflow-x-auto max-h-96 overflow-y-auto">
//           <table className="min-w-full bg-white text-xs border-collapse border border-gray-300">
//               {/* Table Header */}
//             <thead className="bg-gray-100 sticky top-0 z-50 shadow-sm">
//                 {/* Main header row */}
//               <tr>
//                 <th rowSpan={2} className="px-2 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300 bg-gray-100">
//                     SAP ID
//                   </th>
//                 <th rowSpan={2} className="px-2 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300 bg-gray-100">
//                     Location
//                   </th>
//                 <th rowSpan={2} className="px-2 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300 bg-gray-100">
//                   Count
//                   </th>
//                 {expandedRow && (
//                   <>
//                     <th rowSpan={2} className="px-2 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300 bg-gray-100">
//                       Device Name
//                     </th>
//                     <th rowSpan={2} className="px-2 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300 bg-gray-100">
//                       Created At
//                     </th>
//                   </>
//                 )}
//                 {barrierGateHeaders.map((header) => (
//                   <th key={header} colSpan={2} className="px-2 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300 bg-gray-100">
//                     {header.replace(/_/g, ' ')}
//                   </th>
//                 ))}
//                 </tr>
//                 {/* Sub header row */}
//               <tr>
//                 {barrierGateHeaders.map((header) => (
//                   <React.Fragment key={`${header}-subheaders`}>
//                     <th className="px-2 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300 bg-gray-100 border-t border-t-gray-400">
//                     Success
//                   </th>
//                     <th className="px-2 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300 bg-gray-100 border-t border-t-gray-400">
//                     Fail
//                   </th>
//                   </React.Fragment>
//                 ))}
//                 </tr>
//               </thead>

//               {/* Table Body */}
//               <tbody>
//                 {data.map((row, index) => (
//                 <React.Fragment key={row.sap_id}>
//                   <tr className="hover:bg-gray-50">
//                     <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 border border-gray-300">
//                       {row.sap_id}
//                       </td>
//                     <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 border border-gray-300">
//                       {row.location_name}
//                       </td>
//                     <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 text-center cursor-pointer hover:bg-gray-50 border border-gray-300" onClick={() => toggleRow(row.sap_id)}>
//                       <div className="flex items-center justify-center gap-1">
//                         <span>{row[getEquipmentFields().countField] || 0}</span>
//                         {expandedRow === row.sap_id ? (
//                           <ChevronUp className="w-3 h-3" />
//                         ) : (
//                           <ChevronDown className="w-3 h-3" />
//                           )}
//                         </div>
//                       </td>
//                     {expandedRow && (
//                       <>
//                         <td className="px-2 py-2 whitespace-nowrap text-xs border border-gray-300">
//                         </td>
//                         <td className="px-2 py-2 whitespace-nowrap text-xs border border-gray-300">
//                         </td>
//                       </>
//                     )}
//                     {barrierGateHeaders.map((header) => {
//                       const counts = getMainTableCounts(row, header);
//                       const isDeviceSelected = selectedDevice && selectedDevice.sapId === row.sap_id;
//                       return (
//                       <React.Fragment key={`${row.sap_id}-${header}`}>
//                           <td className={`px-2 py-2 whitespace-nowrap text-xs text-green-600 text-center font-semibold border border-gray-300 ${isDeviceSelected ? 'bg-blue-50' : ''}`}>
//                             {counts.success}
//                       </td>
//                           <td className={`px-2 py-2 whitespace-nowrap text-xs text-red-600 text-center font-semibold border border-gray-300 ${isDeviceSelected ? 'bg-blue-50' : ''}`}>
//                             {counts.failed}
//                       </td>
//                       </React.Fragment>
//                       );
//                     })}
//                     </tr>
                    
//                     {/* Expanded Device Rows - shown directly in main table */}
//                   {expandedRow === row.sap_id && row[getEquipmentFields().detailsField] && row[getEquipmentFields().detailsField].length > 0 && 
//                     row[getEquipmentFields().detailsField].map((detail, idx) => {
//                       const isSelected = selectedDevice && selectedDevice.sapId === row.sap_id && selectedDevice.detailIndex === idx;
//                       return (
//                         <tr 
//                           key={`${row.sap_id}-device-${idx}`}
//                           className={`bg-gray-50 hover:bg-gray-100 ${isSelected ? 'bg-blue-100' : ''}`}
//                         >
//                           {/* SAP ID column - empty with indentation, no borders */}
//                           <td className="px-2 py-2 whitespace-nowrap text-xs border-0">
//                             <span className="ml-6"></span>
//                           </td>
//                           {/* Location column - empty with indentation, no borders */}
//                           <td className="px-2 py-2 whitespace-nowrap text-xs border-0">
//                             <span className="ml-6"></span>
//                           </td>
//                           {/* Count column - empty, no borders */}
//                           <td className="px-2 py-2 whitespace-nowrap text-xs border-0">
//                           </td>
//                           {/* Device Name column - show device name */}
//                           <td 
//                             className={`px-2 py-2 whitespace-nowrap text-xs font-medium border border-gray-300 cursor-pointer hover:bg-blue-50 transition-colors ${isSelected ? 'bg-blue-200 text-blue-800 font-bold' : 'text-gray-800'}`}
//                             onClick={() => handleDeviceClick(row.sap_id, idx)}
//                           >
//                             {detail.device_name}
//                           </td>
//                           {/* Created At column - show created date */}
//                           <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 border border-gray-300">
//                             {new Date(detail.created_at).toLocaleString()}
//                           </td>
//                           {/* Barrier gate columns - show device's counts */}
//                           {barrierGateHeaders.map((header) => (
//                             <React.Fragment key={`${row.sap_id}-device-${idx}-${header}`}>
//                               <td className={`px-2 py-2 whitespace-nowrap text-xs text-green-600 text-center font-semibold border border-gray-300 ${isSelected ? 'bg-blue-50' : ''}`}>
//                                 {detail[header]?.[0]?.success || 0}
//                               </td>
//                               <td className={`px-2 py-2 whitespace-nowrap text-xs text-red-600 text-center font-semibold border border-gray-300 ${isSelected ? 'bg-blue-50' : ''}`}>
//                                 {detail[header]?.[0]?.failed || 0}
//                         </td>
//                             </React.Fragment>
//                           ))}
//                       </tr>
//                       );
//                     })
//                   }
//                   </React.Fragment>
//                 ))}
//               </tbody>
//             </table>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default Table;



import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

interface EquipmentTableProps {
  startDate?: string;
  endDate?: string;
  refreshTrigger?: number;
}

const Table = ({ startDate, endDate, refreshTrigger = 0 }: EquipmentTableProps = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [selectedEquipment, setSelectedEquipment] = useState('ESD');
  const [selectedDevice, setSelectedDevice] = useState(null);

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, refreshTrigger, selectedEquipment]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = {
        analytical_model: "Equipment Location Wise Count",
        location_name: "",
        interlock_name: "",
        alert_status: "",
        alert_severity: [],
        zone: "",
        start_date: startDate || new Date().toISOString().split('T')[0],
        end_date: endDate || new Date().toISOString().split('T')[0],
        equipment_name: selectedEquipment,
        download: "",
        top_n: 0
      };

      const response = await apiClient.post('/api/tasanalytics/tas_analytics', payload);
      setData(response.data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch data');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const getBarrierGateHeaders = () => {
    if (!data || data.length === 0) return [];

    const firstItem = data[0];
    const excludeKeys = [
      'sap_id',
      'location_name',
      'equipment_type',
      'no_of_esd_activated', 'esd_activated_details',
      'no_of_vft_activated', 'vft_activated_details',
      'no_of_radar_activated', 'radar_activated_details',
      'no_of_bcu_activated', 'bcu_activated_details',
      'no_of_fire_effect_activated', 'fire_effect_activated_details'
    ];

    return Object.keys(firstItem).filter(key => !excludeKeys.includes(key));
  };

  const barrierGateHeaders = getBarrierGateHeaders();

  const toggleRow = (sapId) => {
    const newExpandedRow = expandedRow === sapId ? null : sapId;
    setExpandedRow(newExpandedRow);
    if (newExpandedRow === null) {
      setSelectedDevice(null);
    }
  };

  const handleDeviceClick = (sapId, detailIndex) => {
    if (selectedDevice && selectedDevice.sapId === sapId && selectedDevice.detailIndex === detailIndex) {
      setSelectedDevice(null);
    } else {
      setSelectedDevice({ sapId, detailIndex });
    }
  };

  const getMainTableCounts = (row, header) => {
    if (selectedDevice && selectedDevice.sapId === row.sap_id) {
      const { detailsField } = getEquipmentFields();
      const details = row[detailsField] || [];
      const detail = details[selectedDevice.detailIndex];
      if (detail && detail[header] && detail[header].length > 0) {
        return {
          success: detail[header][0]?.success || 0,
          failed: detail[header][0]?.failed || 0
        };
      }
    }
    return {
      success: row[header]?.[0]?.success || 0,
      failed: row[header]?.[0]?.failed || 0
    };
  };

  const getEquipmentFields = () => {
    const equipmentType = selectedEquipment.toLowerCase();
    return {
      countField: `no_of_${equipmentType}_activated`,
      detailsField: `${equipmentType}_activated_details`
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-sm text-gray-600">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 text-red-500">
        <p>Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="w-full p-1">
          {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800">Cause & Effect Analysis</h4>
        <div className="flex items-center gap-2">
          <label htmlFor="equipment-select" className="text-xs text-gray-600">Equipment Type:</label>
          <select
            id="equipment-select"
            value={selectedEquipment}
            onChange={(e) => setSelectedEquipment(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ESD">ESD</option>
            <option value="VFT">VFT</option>
            <option value="RADAR">RADAR</option>
            <option value="BCU">BCU</option>
            <option value="FIRE EFFECT">FIRE EFFECT</option>
          </select>
        </div>
          </div>

          {/* Table Container */}
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="min-w-full bg-white text-xs border-collapse border border-gray-300">
              {/* Table Header */}
            <thead className="bg-gray-100 sticky top-0 z-50 shadow-sm">
                {/* Main header row */}
              <tr>
                <th rowSpan={2} className="px-2 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300 bg-gray-100">
                    SAP ID
                  </th>
                <th rowSpan={2} className="px-2 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300 bg-gray-100">
                    Location
                  </th>
                <th rowSpan={2} className="px-2 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300 bg-gray-100">
                  Count
                  </th>
                {barrierGateHeaders.map((header) => (
                  <th key={header} colSpan={2} className="px-2 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300 bg-gray-100">
                    {header.replace(/_/g, ' ')}
                  </th>
                ))}
                </tr>
                {/* Sub header row */}
              <tr>
                {barrierGateHeaders.map((header) => (
                  <React.Fragment key={`${header}-subheaders`}>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300 bg-gray-100 border-t border-t-gray-400">
                    Success
                  </th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300 bg-gray-100 border-t border-t-gray-400">
                    Fail
                  </th>
                  </React.Fragment>
                ))}
                </tr>
              </thead>

              {/* Table Body */}
              <tbody>
                {data.map((row, index) => (
                <React.Fragment key={row.sap_id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 border border-gray-300">
                      {row.sap_id}
                      </td>
                    <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 border border-gray-300">
                      {row.location_name}
                      </td>
                    <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 text-center cursor-pointer hover:bg-gray-50 border border-gray-300" onClick={() => toggleRow(row.sap_id)}>
                      <div className="flex items-center justify-center gap-1">
                        <span>{row[getEquipmentFields().countField] || 0}</span>
                        {expandedRow === row.sap_id ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                          )}
                        </div>
                      </td>
                    {barrierGateHeaders.map((header) => {
                      const counts = getMainTableCounts(row, header);
                      const isDeviceSelected = selectedDevice && selectedDevice.sapId === row.sap_id;
                      return (
                      <React.Fragment key={`${row.sap_id}-${header}`}>
                          <td className={`px-2 py-2 whitespace-nowrap text-xs text-green-600 text-center font-semibold border border-gray-300 ${isDeviceSelected ? 'bg-blue-50' : ''}`}>
                            {counts.success}
                      </td>
                          <td className={`px-2 py-2 whitespace-nowrap text-xs text-red-600 text-center font-semibold border border-gray-300 ${isDeviceSelected ? 'bg-blue-50' : ''}`}>
                            {counts.failed}
                      </td>
                      </React.Fragment>
                      );
                    })}
                    </tr>
                    
                  {/* Expanded Device Rows Header - Device Name and Created At align under SAP ID and Location */}
                  {expandedRow === row.sap_id && row[getEquipmentFields().detailsField] && row[getEquipmentFields().detailsField].length > 0 && (
                    <>
                      <tr className="bg-gray-200">
                        <td className="px-2 py-2 pl-6 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300 bg-gray-200">
                                        Device Name
                                        </td>
                        <td colSpan={2} className="px-2 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300 bg-gray-200">
                          Created At
                        </td>
                        {barrierGateHeaders.map((header) => (
                          <React.Fragment key={`${row.sap_id}-device-header-${header}`}>
                            <td className="px-2 py-2 text-center text-xs border border-gray-300 bg-gray-200"></td>
                            <td className="px-2 py-2 text-center text-xs border border-gray-300 bg-gray-200"></td>
                          </React.Fragment>
                        ))}
                      </tr>
                      {/* Device Data Rows */}
                      {row[getEquipmentFields().detailsField].map((detail, idx) => {
                        const isSelected = selectedDevice && selectedDevice.sapId === row.sap_id && selectedDevice.detailIndex === idx;
                        return (
                          <tr 
                            key={`${row.sap_id}-device-${idx}`}
                            className={`bg-gray-50 hover:bg-gray-100 ${isSelected ? 'bg-blue-100' : ''}`}
                          >
                            <td 
                              className={`px-2 py-2 pl-6 whitespace-nowrap text-xs font-medium border border-gray-300 cursor-pointer hover:bg-blue-50 transition-colors ${isSelected ? 'bg-blue-200 text-blue-800 font-bold' : 'text-gray-800'}`}
                              onClick={() => handleDeviceClick(row.sap_id, idx)}
                            >
                              {detail.device_name}
                            </td>
                            <td colSpan={2} className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 border border-gray-300">
                              {new Date(detail.created_at).toLocaleString()}
                            </td>
                            {barrierGateHeaders.map((header) => (
                              <React.Fragment key={`${row.sap_id}-device-${idx}-${header}`}>
                                <td className={`px-2 py-2 whitespace-nowrap text-xs text-green-600 text-center font-semibold border border-gray-300 ${isSelected ? 'bg-blue-50' : ''}`}>
                                  {detail[header]?.[0]?.success || 0}
                                </td>
                                <td className={`px-2 py-2 whitespace-nowrap text-xs text-red-600 text-center font-semibold border border-gray-300 ${isSelected ? 'bg-blue-50' : ''}`}>
                                  {detail[header]?.[0]?.failed || 0}
                                </td>
                              </React.Fragment>
                            ))}
                          </tr>
                        );
                      })}
                    </>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default Table;