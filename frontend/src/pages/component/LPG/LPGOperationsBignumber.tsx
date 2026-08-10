import React, { useEffect, useState } from 'react';
import { Card } from '@/@/components/ui/card';
import { Button } from '@/@/components/ui/button';
import axios from 'axios';
import { ScrollArea } from '@/@/components/ui/scroll-area';
import { Search } from '@/pages/dashboard/ActionCenter/Dashboard';
import { Popover, PopoverContent, PopoverTrigger } from '@/@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/@/components/ui/dialog';
import LPGCSRejection from './Plant/LPGOperations/LPGCSRejection';
import LPGGDRejection from './Plant/LPGOperations/LPGGDRejection';
import LPGPTRejection from './Plant/LPGOperations/LPGPTRejection';
import { apiClient } from '@/services/apiClient';
import { PlugZap, Loader2, ChevronRight } from 'lucide-react';

const cardConfigs = [ 
  {
    title: 'Total Plants',
    drillState: 'lpg_operations_connected_plants',
    responseKey: 'Cylinders_Filled',
    action: 'plants_connected',
    showCR: false,
    showLakhs: false,
    isStatic: false,
    isTotal: true,
  },
  {
    title: 'Avaialble Plant Data',
    drillState: 'lpg_operations_connected_plants',
    responseKey: 'Cylinders_Filled',
    action: 'plants_connected',
    showCR: false,
    showLakhs: false,
    isStatic: false,
    isConnectedOnly: true
  },
  {
    title: 'Filled Cylinder(lakhs)',
    drillState: 'lpg_operations_current_month_cylinder_filled',
    responseKey: 'Cylinders_Filled',
    showCR: false,
    showLakhs: false,
    isStatic: false,
  },
  {
    title: 'Check Scale Rejection',
    drillState: 'lpg_operations_current_month_cs_rejection',
    responseKey: 'cs_rejection',
    showCR: true,
    showLakhs: false,
    isStatic: false,
    component: "LPGCSRejection"
  },
  {
    title: 'Total Production (MT)',
    drillState: 'lpg_operations_current_month_production',
    responseKey: 'current_month_production',
    showCR: false,
    showLakhs: false,
    isStatic: false,
  },
  {
    title: 'Valve Leak Rejection',
    drillState: 'lpg_operations_current_month_gd_rejection',
    responseKey: 'gd_rejection',
    showCR: true,
    showLakhs: false,
    isStatic: false,
    component: "LPGGDRejection"
  },
  {
    title: 'Productivity(Cyl/hr)',
    drillState: 'lpg_operations_current_month_productivity',
    responseKey: 'Total Productivity',
    showCR: false,
    showLakhs: false,
    isStatic: false,
  },
  {
    title: 'O-Ring Leak Rejection',
    drillState: 'lpg_operations_current_month_pt_rejection',
    responseKey: 'pt_rejection',
    showCR: true,
    showLakhs: false,
    isStatic: false,
    component: "LPGPTRejection"
  }
];

interface LPGOperationsDashboardProps {
  onCardClick: (section: string) => void;
  activeFilters?: {
    key: string;
    cond: string;
    value: string;
  }[];
  crossFilters?: {
    key: string;
    cond: string;
    value: string;
  }[];
}

const LPGOperationsDashboard: React.FC<LPGOperationsDashboardProps> = ({ 
  onCardClick, 
  activeFilters = [], 
  crossFilters = [] 
}) => {
  const [cardData, setCardData] = useState({});
  const [plantsData, setPlantsData] = useState(null);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConnDialogOpen, setIsConnDialogOpen] = useState(false);
  const [connectionRows, setConnectionRows] = useState<any[]>([]);
  const [isConnLoading, setIsConnLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Add loading state
  const [isPlantStatusDialogOpen, setIsPlantStatusDialogOpen] = useState(false);
  const [plantStatusData, setPlantStatusData] = useState<any[]>([]);
  const [isPlantStatusLoading, setIsPlantStatusLoading] = useState(false);
  const [availableCount, setAvailableCount] = useState<number>(0);
  const [totalPlantCount, setTotalPlantCount] = useState<number>(0);

  const [activeSection, setActiveSection] = useState(null);

  const formatFiltersForApi = (filters) => {
    // Convert filter format if needed for the API
    return filters.map(filter => {
      // Remove quotes if they exist in the key
      const key = filter.key.replace(/"/g, '');
      return {
        key,
        cond: filter.cond,
        value: filter.value
      };
    });
  };

  // Fetch plant status data for "Available Plant Data" card - just opens the dialog
  const openPlantStatusDialog = () => {
    setIsPlantStatusDialogOpen(true);
  };

  const PlantList = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('all');
    
    if (!plantsData) return <div>Loading plants...</div>;
    
    const filteredData = plantsData.filter(plant =>
      (plant.sap_id && plant.sap_id.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filter === 'all' ||
        (filter === 'connected' && plant.status === 'Available') ||
        (filter === 'disconnected' && plant.status === 'Not Available'))
    );
  
    return (
      <div className="w-[280px] bg-white">
        {/* Search Bar */}
        <div className="px-3 py-2 border-b">
          <div className="relative">
            <input
              type="text"
              placeholder="Search plants..."
              className="w-full pl-8 pr-3 py-1 text-sm rounded-md border border-gray-200 
                        focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-2 top-1.5 h-4 w-4 text-gray-400" />
          </div>
        </div>
  
        {/* Filter Buttons */}
        <div className="flex px-1 py-1 gap-1 border-b">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 px-2 py-1 text-sm font-medium rounded ${
              filter === 'all'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('connected')}
            className={`flex-1 px-2 py-1 text-sm font-medium rounded ${
              filter === 'connected'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600'
            }`}
          >
            Connected
          </button>
          <button
            onClick={() => setFilter('disconnected')}
            className={`flex-1 px-2 py-1 text-sm font-medium rounded ${
              filter === 'disconnected'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600'
            }`}
          >
            NotConnected
          </button>
        </div>
  
        {/* Plant List */}
        <ScrollArea className="h-[300px]">
          <div className="py-1">
            {filteredData.map((plant, index) => (
              <div
                key={index}
                className="flex items-center justify-between px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    plant.status === 'Connected'
                      ? 'bg-green-500'
                      : 'bg-red-500'
                  }`} />
                  <span className="text-sm text-gray-700">
                    {plant.location_name}
                  </span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  plant.status === 'Connected'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}>
                  {plant.status}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  };

  const PlantStatusTable = () => {
    if (!connectionRows || connectionRows.length === 0) {
      return (
        <div className="w-full">
          <div className="px-4 pt-4">
            <h2 className="text-lg font-semibold text-gray-800">Plant Connection Status</h2>
          </div>
          <div className="max-h-[70vh] overflow-auto border rounded-md mx-1">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b text-gray-700">
                <tr>
                  <th className="px-4 py-1 w-20">Sl. No.</th>
                  <th className="px-4 py-1">Plant Name</th>
                  <th className="px-4 py-1 w-40">Status</th>
                  <th className="px-4 py-1 w-40">Latency (ms)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-1 text-gray-700">
                      <span className="inline-block w-6 h-3 bg-gray-200 rounded animate-pulse"></span>
                    </td>
                    <td className="px-4 py-1 text-gray-800">
                      <span className="inline-block w-48 h-3 bg-gray-200 rounded animate-pulse"></span>
                    </td>
                    <td className="px-4 py-1">
                      <span className="inline-flex items-center justify-center text-xs font-semibold px-3 py-1 rounded-md bg-gray-200 text-gray-700">
                        <span className="inline-block w-6 text-center animate-pulse">...</span>
                      </span>
                    </td>
                    <td className="px-4 py-1 text-gray-700">
                      <span className="inline-block w-10 h-3 bg-gray-200 rounded animate-pulse"></span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full">
        <div className="px-4 pt-4">
          <h2 className="text-lg font-semibold text-gray-800">Plant Connection Status</h2>
        </div>
        <div className="max-h-[70vh] overflow-auto border rounded-md mx-1">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-gray-50 border-b text-gray-700">
              <tr>
                <th className="px-4 py-1 w-20">Sl. No.</th>
                <th className="px-4 py-1">Plant Name</th>
                <th className="px-4 py-1 w-40">Status</th>
                <th className="px-4 py-1 w-40">Latency (ms)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {connectionRows.map((row, idx) => (
                <tr key={row.sap_id || idx} className="hover:bg-gray-50">
                  <td className="px-4 py-1 text-gray-700">{idx + 1}</td>
                  <td className="px-4 py-1 text-gray-800">{row.name}</td>
                  <td className="px-4 py-1">
                    {(() => {
                      const s = (row.status || '').toString();
                      const sl = s.toLowerCase();
                      const cls = row.loading
                        ? 'bg-yellow-100 text-yellow-800'
                        : sl === 'live'
                          ? 'bg-green-200 text-green-800'
                          : sl === 'down'
                            ? 'bg-red-200 text-red-800'
                            : 'bg-yellow-100 text-yellow-800';
                      if (row.loading) {
                        return (
                          <span className="inline-flex items-center gap-2 justify-center text-xs font-semibold px-3 py-1 rounded-md bg-gray-200 text-gray-700">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Pending</span>
                          </span>
                        );
                      }
                      return (
                        <span className={`inline-flex items-center justify-center text-xs font-semibold px-3 py-1 rounded-md ${cls}`}>
                          {s || '-'}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-1 text-gray-700">{row.loading ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{animationDelay: '0ms'}}></span>
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{animationDelay: '150ms'}}></span>
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{animationDelay: '300ms'}}></span>
                    </span>
                  ) : (row.latency ?? '-')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // const BigNumberCard = ({ title, value, showCR, showLakhs, isTotal = false, component, onClick }) => {
  //   const handleCardClick = () => {
  //     if (component) {
  //       setSelectedComponent(component);
  //       setIsDialogOpen(true);
  //     } else if (onClick) {
  //       // Map card titles to section IDs
  //       const sectionIdMap = {
  //         'Current Month Filled Cylinder(lakhs)': 'filledCylinder',
  //         'Check Scale Rejection': 'csRejection',
  //         'Current Month Total Production (MT)': 'production',
  //         'Valve Leak Rejection': 'gdRejection',
  //         'Current Month Productivity(Cyl/hr)': 'productivity',
  //         'O-Ring Leak Rejection': 'PTRejections'
  //       };
        
  //       const sectionId = sectionIdMap[title];
  //       if (sectionId) {
  //         onClick(sectionId);
  //       }
  //     }
  //   };

  //   // Check if value is still loading
  //   const isValueLoading = value === 'Loading...' || value === null || value === undefined;

  //   const CardContent = (
  //     <Card 
  //       className="h-20 w-full from-amber-200 to-amber-100 cursor-pointer bg-[#424771]"
  //       onClick={handleCardClick}
  //     >
  //       <div className="h-full flex flex-col">
  //         <div className="text-center w-full">
  //           <h2 className="text-[10px] font-semibold text-gray-800 px-2 truncate text-white">
  //             {title}
  //           </h2>
  //         </div>
  //         <div className="flex-1 flex items-center justify-center px-2">
  //           {isValueLoading ? (
  //             <div className="flex items-center gap-2">
  //               <Loader2 className="h-4 w-4 animate-spin text-white" />
  //               <span className="text-sm text-white">Loading...</span>
  //             </div>
  //           ) : (
  //             (() => {
  //               const isValve = title === 'Valve Leak Rejection' || title === 'O-Ring Leak Rejection';
  //               const hasAggregate = value && typeof value === 'object' && 'percentage' in (value as any);
  //               const displayValue = hasAggregate ? (value as any).percentage : value;
  //               return (
  //                 <div className="text-center">
  //                   <p className="text-[15px] font-bold text-gray-900 text-white">
  //                     {typeof displayValue === 'number' ? displayValue.toFixed(2) : displayValue}
  //                     {showCR && <span className="text-sm ml-1">%</span>}
  //                     {showLakhs && <span className="text-sm ml-1">lakhs</span>}
  //                   </p>
  //                   {isValve && hasAggregate && (
  //                     <p className="text-[10px] text-gray-200 mt-0.5">
  //                       Handled: {(value as any).handled.toLocaleString()} | Sortout: {(value as any).sortout.toLocaleString()}
  //                     </p>
  //                   )}
  //                 </div>
  //               );
  //             })()
  //           )}
  //         </div>
  //       </div>
  //     </Card>
  //   );
  
  //   if (isTotal) {
  //     return (
  //       <Button
  //         className="h-20 w-full rounded-md border border-blue-200 bg-[#424771] hover:bg-[#424771] hover:opacity-100 text-white-800 text-xs font-semibold shadow-sm focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:outline-none flex items-center justify-between px-2 transition-none"
  //         onClick={() => setIsConnDialogOpen(true)}
  //       >
  //         <div className="flex items-center gap-3">
  //           <span className="text-left leading-tight">
  //             <span className="block text-white text-[13px] font-bold">Total plants : 55</span>
  //             <span className="block text-white text-[13px] font-bold">Check Connection Status</span>
  //             <span className="block text-[10px] text-gray-400 uppercase tracking-wide">(Click here)</span>
  //           </span>
  //         </div>
  //         <ChevronRight className="h-4 w-4 text-blue-700 opacity-80" />
  //       </Button>
  //     );
  //   }
  
  //   return CardContent;
  // };
  
  // Function to prepare filters for API request
const BigNumberCard = ({ title, value, showCR, showLakhs, isTotal = false, isConnectedOnly = false, component, onClick }) => {
  const handleCardClick = () => {
    if (isConnectedOnly) {
      // Handle "Available Plant Data" card click - just open dialog
      openPlantStatusDialog();
    } else if (component) {
      setSelectedComponent(component);
      setIsDialogOpen(true);
    } else if (onClick) {
      const sectionIdMap = {
        'Filled Cylinder(lakhs)': 'filledCylinder',
        'Check Scale Rejection': 'csRejection',
        'Total Production (MT)': 'production',
        'Valve Leak Rejection': 'gdRejection',
        'Productivity(Cyl/hr)': 'productivity',
        'O-Ring Leak Rejection': 'PTRejections'
      };

      const sectionId = sectionIdMap[title];
      if (sectionId) {
        onClick(sectionId);
      }
    }
  };

  const isValueMissing = value === null || value === undefined;

  // Accent color per card type (aligned with Compliance & TAS Governance styling)
  const getAccentColor = () => {
    if (title.includes('Rejection')) return 'border-l-amber-500';
    if (title.includes('Available') && title.includes('Plant')) return 'border-l-emerald-500';
    if (title.includes('Total Plants')) return 'border-l-[#2563eb]';
    if (title.includes('Production') || title.includes('Productivity') || title.includes('Filled')) return 'border-l-emerald-500';
    return 'border-l-[#2563eb]';
  };

  const CardContent = (
    <Card 
      className={`w-full cursor-pointer border border-slate-200 border-l-4 px-3 py-1.5 rounded-lg shadow-sm bg-white hover:shadow-md hover:bg-slate-50/50 transition-all duration-200 ${getAccentColor()}`}
      onClick={handleCardClick}
    >
      <div className="min-w-0 overflow-visible">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 break-words leading-tight">
          {title}
        </p>
        <div className="min-h-[40px] flex items-start">
          {isValueMissing ? (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span className="text-xs font-medium">Loading...</span>
            </div>
          ) : (
            (() => {
              const isValve = title === 'Valve Leak Rejection' || title === 'O-Ring Leak Rejection';
              const hasAggregate = value && typeof value === 'object' && 'percentage' in (value as any);
              const displayValue = hasAggregate ? (value as any).percentage : value;
              const formattedValue = typeof displayValue === 'number' ? displayValue.toLocaleString(undefined, { maximumFractionDigits: 2 }) : displayValue;

              return (
                <div className="min-w-0 w-full">
                  <p className="text-2xl font-black text-slate-900 break-all leading-tight">
                    {formattedValue}
                    {showCR && <span className="text-lg font-bold ml-0.5">%</span>}
                    {showLakhs && <span className="text-xs font-bold text-slate-600 ml-0.5">lakhs</span>}
                  </p>
                  {isValve && hasAggregate && (
                    <p className="text-[10px] text-slate-500 font-medium mt-1">
                      Handled: {(value as any).handled.toLocaleString()} | Sortout: {(value as any).sortout.toLocaleString()}
                    </p>
                  )}
                </div>
              );
            })()
          )}
        </div>
      </div>
    </Card>
  );

  if (isTotal) {
    return (
      <Card 
        className="w-full cursor-pointer border border-slate-200 border-l-4 border-l-[#2563eb] px-3 py-3 rounded-lg shadow-sm bg-white hover:shadow-md hover:bg-slate-50/50 transition-all duration-200"
        onClick={() => setIsConnDialogOpen(true)}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 leading-tight">Total Plants</p>
            {value === null || value === undefined ? (
              <div className="flex items-center gap-2 text-slate-400 min-h-[30px]">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <span className="text-xs font-medium">Loading...</span>
              </div>
            ) : (
              <p className="text-2xl font-black text-slate-900 break-all leading-tight">{value}</p>
            )}
            <p className="text-[10px] font-medium text-slate-500 mt-1 break-words">Check Connection Status (Click here)</p>
          </div>
          <ChevronRight className="w-6 h-6 text-[#2563eb] shrink-0" />
        </div>
      </Card>
    );
  }

  return CardContent;
};


  const prepareFiltersForRequest = () => {
    const apiFilters = formatFiltersForApi(activeFilters || []);
    
    // Build filter string with zone, plant, filling_head if present
    const filterParams = apiFilters.reduce((params, filter) => {
      if (filter.key === 'zone' || filter.key === 'plant' || filter.key === 'filling_head') {
        params[filter.key] = filter.value;
      }
      return params;
    }, {});
    
    // Handle date range filter
    const dateFilter = apiFilters.find(filter => filter.key === 'RANGE');
    if (dateFilter) {
      const [startDate, endDate] = dateFilter.value.split(',');
      filterParams.range = `(${startDate},${endDate})`;
    }
    return filterParams;
  }
  
  useEffect(() => {
    const fetchCardData = async () => {
      try {
        setIsLoading(true); // Set loading to true at start
        const filterParams = prepareFiltersForRequest();
        
        // Separate request for plants data
        const plantsResponse = await apiClient.post('/api/charts/generate_vis_data', {
          // filters:  [],
           filters: [
    { 
      key: 'plant_name', 
      cond: 'eq',
      value: filterParams.plant_name 
    }
  ],
          action: 'plants_connected',
          drill_state: 'lpg_operations_connected_plants',
          cross_filters: crossFilters || [],
          
          // ...filterParams
        });

        if (plantsResponse.data?.status) {
          setPlantsData(plantsResponse.data.data);
        }

        // Fetch plant status data for Available Plant Data card
        try {
          const statusResponse = await apiClient.post('/api/charts/generate_vis_data', {
            filters: [],
            action: 'card_chart',
            drill_state: 'lpg_plant_status',
            cross_filters: []
          });
          
          const data = statusResponse?.data?.data || statusResponse?.data || [];
          const dataArray = Array.isArray(data) ? data : [data];
          setPlantStatusData(dataArray);
          
          // Calculate available and total counts from API response
          const total = dataArray.length;
          const available = dataArray.filter(item => {
            const status = item?.data_status || item?.status || '';
            return status.toLowerCase() === 'available';
          }).length;
          
          setAvailableCount(available);
          setTotalPlantCount(total);
        } catch (statusError) {
          console.error('Error fetching plant status data:', statusError);
          setPlantStatusData([]);
          setAvailableCount(0);
          setTotalPlantCount(0);
        }

        // Handle other cards
        const promises = cardConfigs
          .filter(card => !card.isTotal && !card.isConnectedOnly)
          .map(async (card) => {
            const response = await apiClient.post('/api/charts/generate_vis_data', {
              filters: [],
              action: card.action ? card.action : 'card_chart',
              drill_state: card.drillState,
              cross_filters: crossFilters || [],
              // ...filterParams
            });

            if (response.data?.status) {
              if (card.title === 'Valve Leak Rejection' || card.title === 'O-Ring Leak Rejection') {
                const payload = response.data?.data;
                if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
                  let totalHandled = 0;
                  let totalSortout = 0;
                  Object.values(payload).forEach((rec: any) => {
                    totalHandled += Number(rec?.handled || 0);
                    totalSortout += Number(rec?.sortout || 0);
                  });
                  const percentage = totalHandled > 0 ? (totalSortout / totalHandled) * 100 : 0;
                  return {
                    [card.drillState]: {
                      handled: totalHandled,
                      sortout: totalSortout,
                      percentage,
                    }
                  };
                }
              }
              return { 
                [card.drillState]: response.data.data[0]?.[card.responseKey] ?? 'N/A' 
              };
            }
            return { [card.drillState]: 'Error' };
          });

        const results = await Promise.all(promises);
        setCardData(Object.assign({}, ...results));
      } catch (error) {
        console.error('Error fetching card data:', error);
      } finally {
        setIsLoading(false); // Set loading to false when done
      }
    };

    fetchCardData();
  }, [activeFilters, crossFilters]);

  // When opening the connection dialog, call check_connection_status
  useEffect(() => {
    const fetchConnectionStatus = async () => {
      if (!isConnDialogOpen) return;

      try {
        setIsConnLoading(true);
        // Get master plant list with sap_id + location_name
        const masterResp = await apiClient.post('/api/charts/generate_vis_data', {
          action: 'plants_dropdown',
          payload: {
            filters: [],
            cross_filters: [],
            drill_state: ''
          }
        });
        const masterCore = masterResp?.data?.data || masterResp?.data || {};
        const plantList = Array.isArray(masterCore?.plant) ? masterCore.plant : [];

        // seed rows from master list
        const initialRows = plantList.map((p: any) => ({
          sap_id: String(p?.sap_id || ''),
          name: p?.location_name || '-',
          status: undefined,
          latency: undefined,
          loading: true,
        }));
        setConnectionRows(initialRows);

        // Fire all requests at once and update rows as each resolves
        const requests = initialRows.map((row: any) =>
          apiClient
            .post('/api/lpgplantoperations/check_connection_status', { sap_id: row.sap_id })
            .then((res) => {
              const payload = res?.data?.data || res?.data || {};
              const rec = Array.isArray(payload?.connection_status) && payload.connection_status.length > 0
                ? payload.connection_status[0]
                : {};
              const updatedRow = {
                ...row,
                name: rec?.plant_name || row.name, // Use plant_name from API response
                status: String(rec?.status || '').toUpperCase(),
                latency: rec?.latency ?? '-',
                loading: false,
              };
              setConnectionRows(prev => prev.map(r => (r.sap_id === row.sap_id ? updatedRow : r)));
            })
            .catch(() => {
              const failedRow = { ...row, status: 'DOWN', latency: '-', loading: false };
              setConnectionRows(prev => prev.map(r => (r.sap_id === row.sap_id ? failedRow : r)));
            })
        );

        await Promise.allSettled(requests);
      } catch (e) {
        console.error('Error checking connections:', e);
      } finally {
        setIsConnLoading(false);
      }
    };

    fetchConnectionStatus();
  }, [isConnDialogOpen, plantsData]);

  const getCardValue = (item) => {
    // Return null during initial loading to trigger loading state
    if (isLoading) return null;
    
    if (item.isTotal) {
      // Use same total as Available Plant Data (denominator) for consistency
      if (totalPlantCount > 0) return totalPlantCount;
      return null;
    }

    if (item.isConnectedOnly) {
      // Use counts from API response
      if (totalPlantCount > 0) {
        return `${availableCount} / ${totalPlantCount}`;
      }
      return null;
    }

    return cardData[item.drillState] ?? null;
  };

   const renderSelectedComponent = () => {
    const commonRejectionProps = {
      activeFilters: activeFilters || [],
      crossFilters: crossFilters || [],
      onResetFilters: () => {},
      selectedFromDate: undefined,
      selectedToDate: undefined,
      embeddedInDialog: true,
      onCloseDialog: () => setIsDialogOpen(false),
    };
    switch (selectedComponent) {
      case 'LPGCSRejection':
        return <LPGCSRejection {...commonRejectionProps} />;
      case 'LPGGDRejection':
        return <LPGGDRejection {...commonRejectionProps} />;
      case 'LPGPTRejection':
        return <LPGPTRejection {...commonRejectionProps} />;
      default:
        return null;
    }
  };

  return (
    <>
      <div className="p-1 max-w-[1800px] mx-auto text-[13px] font-sans text-slate-900">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {cardConfigs.map((item, index) => (
            <BigNumberCard
              key={index}
              title={item.title}
              value={item.isStatic ? item : getCardValue(item)}
              showCR={item.showCR}
              showLakhs={item.showLakhs}
              isTotal={item.title === 'Total Plants'}
              isConnectedOnly={item.isConnectedOnly}
              component={item.component}
              onClick={onCardClick}
            />
          ))}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[95vw] max-h-[98vh] w-full h-[95vh] min-h-[720px] overflow-hidden flex flex-col pt-2 pr-2 pb-6 pl-6 [&>button]:h-4 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button_svg]:h-3 [&>button_svg]:w-3 [&>button]:absolute [&>button]:right-2 [&>button]:top-2 [&>button]:border-0 [&>button]:outline-none focus:[&>button]:ring-0">
          <div className="w-full flex-1 min-h-0 overflow-hidden hide-scrollbar flex flex-col">
            {renderSelectedComponent()}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isConnDialogOpen} onOpenChange={setIsConnDialogOpen}>
        <DialogContent className="sm:max-w-[1100px] w-full max-h-[85vh] [&>button]:h-4 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button_svg]:h-3 [&>button_svg]:w-3 [&>button]:border-0 [&>button]:outline-none focus:[&>button]:ring-0">
          <PlantStatusTable />
        </DialogContent>
      </Dialog>

      {/* Plant Status Dialog for "Available Plant Data" */}
      <Dialog open={isPlantStatusDialogOpen} onOpenChange={setIsPlantStatusDialogOpen}>
        <DialogContent className="sm:max-w-[1100px] w-full max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Plant Data Details</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[70vh]">
            {isPlantStatusLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading plant status data...</span>
              </div>
            ) : plantStatusData.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">No data available</p>
              </div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    {plantStatusData.length > 0 && Object.keys(plantStatusData[0]).map((key) => (
                      <th key={key} className="text-left py-2 px-3 font-semibold text-gray-700 border">
                        {key.replace(/_/g, ' ').toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plantStatusData.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      {Object.entries(row).map(([key, value]: [string, any], colIndex) => {
                        // Check if this is a status column
                        const isStatusColumn = key.toLowerCase().includes('status') || key.toLowerCase() === 'data_status';
                        const cellValue = value !== null && value !== undefined ? String(value) : '-';
                        
                        // Apply color based on status
                        let statusClass = '';
                        if (isStatusColumn) {
                          const lowerValue = cellValue.toLowerCase();
                          if (lowerValue === 'connected' || lowerValue === 'up' || lowerValue === 'available') {
                            statusClass = 'text-green-700 font-semibold';
                          } else if (lowerValue === 'not connected' || lowerValue === 'down' || lowerValue === 'not available') {
                            statusClass = 'text-red-700 font-semibold';
                          }
                        }
                        
                        return (
                          <td key={colIndex} className={`py-2 px-3 text-gray-900 border ${statusClass}`}>
                            {cellValue}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LPGOperationsDashboard;