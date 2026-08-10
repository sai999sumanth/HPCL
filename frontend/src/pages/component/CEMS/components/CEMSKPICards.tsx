

import React, { useState, useEffect, useMemo } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Search, X } from 'lucide-react';
import { apiClient } from "@/services/apiClient";
import { Card, CardContent } from '@/@/components/ui/card';

// SolarPanel icon component
const SolarPanel = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M8 2a4 4 0 1 0 8 0" />
    <path d="M4 3h1" />
    <path d="M19 3h1" />
    <path d="M12 9v1" />
    <path d="M17.2 7.2l.707 .707" />
    <path d="M6.8 7.2l-.7 .7" />
    <path d="M4.28 21h15.44a1 1 0 0 0 .97 -1.243l-1.5 -6a1 1 0 0 0 -.97 -.757h-12.44a1 1 0 0 0 -.97 .757l-1.5 6a1 1 0 0 0 .97 1.243z" />
    <path d="M4 17h16" />
    <path d="M10 13l-1 8" />
    <path d="M14 13l1 8" />
  </svg>
);

interface CEMSKPICardsProps {
  zone?: string[] | string;
  dateFilter?: string | { key: string; cond: string; value: string }; // New prop for date filter
  refreshKey?: number;
  selectedLocation?: string | null;
  selectedPlant?: string | null;
  bu?: string;
}

const CEMSKPICards: React.FC<CEMSKPICardsProps> = ({ zone, dateFilter = '1M', refreshKey = 0, selectedLocation = null, selectedPlant = null, bu = 'TAS' }) => {
  const [installedCapacity, setInstalledCapacity] = useState<string>('0');
  const [isLoadingCapacity, setIsLoadingCapacity] = useState(true);
  const [energyGenerated, setEnergyGenerated] = useState<{ actual: string; estimated: string }>({ actual: '0', estimated: '0' });
  const [isLoadingEnergy, setIsLoadingEnergy] = useState(true);
  const [avgEfficiency, setAvgEfficiency] = useState<string>('0');
  const [isLoadingEfficiency, setIsLoadingEfficiency] = useState(true);
  const [activeTotalPlants, setActiveTotalPlants] = useState<{ active: string; inactive: string; notConnected: string; total: string; critical: string }>({ active: '0', inactive: '0', notConnected: '0', total: '0', critical: '0' });
  const [isLoadingPlants, setIsLoadingPlants] = useState(true);
  const [activePlantsList, setActivePlantsList] = useState<Array<{ PLANT_CD: string; LocationName: string; Plant_Capacity?: number; status?: string }>>([]);
  const [inactivePlantsList, setInactivePlantsList] = useState<Array<{ PLANT_CD: string; LocationName: string; Plant_Capacity?: number; status?: string }>>([]);
  const [notConnectedPlantsList, setNotConnectedPlantsList] = useState<Array<{ PLANT_CD: string; LocationName: string; Plant_Capacity?: number; status?: string }>>([]);
  const [showPlantsTable, setShowPlantsTable] = useState(false);
  const [showInactivePlantsTable, setShowInactivePlantsTable] = useState(false);
  const [showNotConnectedPlantsTable, setShowNotConnectedPlantsTable] = useState(false);
  const [plantsSearchTerm, setPlantsSearchTerm] = useState('');
  const [inactivePlantsSearchTerm, setInactivePlantsSearchTerm] = useState('');
  const [notConnectedPlantsSearchTerm, setNotConnectedPlantsSearchTerm] = useState('');
  const [plantsCurrentPage, setPlantsCurrentPage] = useState(1);
  const [inactivePlantsCurrentPage, setInactivePlantsCurrentPage] = useState(1);
  const [notConnectedPlantsCurrentPage, setNotConnectedPlantsCurrentPage] = useState(1);
  const [plantsItemsPerPage, setPlantsItemsPerPage] = useState(10);
  const [inactivePlantsItemsPerPage, setInactivePlantsItemsPerPage] = useState(10);
  const [notConnectedPlantsItemsPerPage, setNotConnectedPlantsItemsPerPage] = useState(10);

  // Filter and paginate active plants data
  const filteredPlantsData = useMemo(() => {
    if (!plantsSearchTerm) return activePlantsList;

    return activePlantsList.filter(plant =>
      plant.PLANT_CD.toLowerCase().includes(plantsSearchTerm.toLowerCase()) ||
      plant.LocationName.toLowerCase().includes(plantsSearchTerm.toLowerCase())
    );
  }, [activePlantsList, plantsSearchTerm]);

  // Filter and paginate inactive plants data
  const filteredInactivePlantsData = useMemo(() => {
    if (!inactivePlantsSearchTerm) return inactivePlantsList;

    return inactivePlantsList.filter(plant =>
      plant.PLANT_CD.toLowerCase().includes(inactivePlantsSearchTerm.toLowerCase()) ||
      plant.LocationName.toLowerCase().includes(inactivePlantsSearchTerm.toLowerCase())
    );
  }, [inactivePlantsList, inactivePlantsSearchTerm]);

  // Filter and paginate not connected plants data
  const filteredNotConnectedPlantsData = useMemo(() => {
    if (!notConnectedPlantsSearchTerm) return notConnectedPlantsList;

    return notConnectedPlantsList.filter(plant =>
      plant.PLANT_CD.toLowerCase().includes(notConnectedPlantsSearchTerm.toLowerCase()) ||
      plant.LocationName.toLowerCase().includes(notConnectedPlantsSearchTerm.toLowerCase())
    );
  }, [notConnectedPlantsList, notConnectedPlantsSearchTerm]);

  const getPlantsPaginatedData = (currentPage: number, itemsPerPage: number) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredPlantsData.slice(startIndex, endIndex);
  };

  const getInactivePlantsPaginatedData = (currentPage: number, itemsPerPage: number) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredInactivePlantsData.slice(startIndex, endIndex);
  };

  const getNotConnectedPlantsPaginatedData = (currentPage: number, itemsPerPage: number) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredNotConnectedPlantsData.slice(startIndex, endIndex);
  };

  const getPlantsTotalPages = (itemsPerPage: number) => {
    return Math.ceil(filteredPlantsData.length / itemsPerPage);
  };

  const getInactivePlantsTotalPages = (itemsPerPage: number) => {
    return Math.ceil(filteredInactivePlantsData.length / itemsPerPage);
  };

  const getNotConnectedPlantsTotalPages = (itemsPerPage: number) => {
    return Math.ceil(filteredNotConnectedPlantsData.length / itemsPerPage);
  };

  const handlePlantsPageChange = (page: number) => {
    setPlantsCurrentPage(page);
  };

  const handleInactivePlantsPageChange = (page: number) => {
    setInactivePlantsCurrentPage(page);
  };

  const handleNotConnectedPlantsPageChange = (page: number) => {
    setNotConnectedPlantsCurrentPage(page);
  };

  const handlePlantsItemsPerPageChange = (newItemsPerPage: number) => {
    setPlantsItemsPerPage(newItemsPerPage);
    setPlantsCurrentPage(1); // Reset to first page
  };

  const handleInactivePlantsItemsPerPageChange = (newItemsPerPage: number) => {
    setInactivePlantsItemsPerPage(newItemsPerPage);
    setInactivePlantsCurrentPage(1); // Reset to first page
  };

  const handleNotConnectedPlantsItemsPerPageChange = (newItemsPerPage: number) => {
    setNotConnectedPlantsItemsPerPage(newItemsPerPage);
    setNotConnectedPlantsCurrentPage(1); // Reset to first page
  };

  const closePlantsModal = () => {
    setShowPlantsTable(false);
    setPlantsSearchTerm('');
    setPlantsCurrentPage(1);
  };

  const closeInactivePlantsModal = () => {
    setShowInactivePlantsTable(false);
    setInactivePlantsSearchTerm('');
    setInactivePlantsCurrentPage(1);
  };

  const closeNotConnectedPlantsModal = () => {
    setShowNotConnectedPlantsTable(false);
    setNotConnectedPlantsSearchTerm('');
    setNotConnectedPlantsCurrentPage(1);
  };

  // Function to get the correct date filter value
  const getDateFilterValue = (filter: string | { key: string; cond: string; value: string } | undefined): string => {
    // Handle date range objects (custom date ranges)
    if (filter && typeof filter === 'object' && 'key' in filter && 'value' in filter) {
      // This is a custom date range filter - return the value as is
      // Expected format: "2026-12-1,2026-12-1"
      return filter.value;
    }

    // Handle string filters
    if (typeof filter === 'string') {
      const filterMap: { [key: string]: string } = {
        't': 't',           // Today
        'tdy': 't',         // Today (alternative)
        '1d': '1d',         // Yesterday
        'ydy': '1d',        // Yesterday (alternative)
        '1w': '1w',         // 1 Week
        '15d': '15d',       // 15 Days
        '1m': '1m',         // 1 Month
        '3m': '3m',         // 3 Months
        'custom': 'custom'  // Date Range
      };
      return filterMap[filter.toLowerCase()] || filter; // Return original filter if not in map
    }

    // Default to today
    return 't';
  };

  // Fetch Total Installed Capacity
  useEffect(() => {
    const fetchInstalledCapacity = async () => {
      try {
        setIsLoadingCapacity(true);
        const filterValue = getDateFilterValue(dateFilter);
        
        const apiBU = bu === 'TAS' ? 'SOD' : (bu || 'SOD');
        const payload = {
          "bu": apiBU,
          "action": "get_total_installed_capacity",
          "filters": [
            {"key":"bu","cond":"=","value": apiBU},
            {"key":"timestamp_ist","cond":"date_filter","value": filterValue},
            ...(zone ? [{"key":"zone","cond":"=","value": Array.isArray(zone) ? zone[0]?.toUpperCase() : zone.toUpperCase()}] : []),
            ...(selectedPlant ? [{"key":"sap_id","cond":"=","value": selectedPlant}] : []),
            ...(selectedLocation ? [{"key":"location_name","cond":"=","value": selectedLocation}] : [])
          ],
          "drill_state": "",
          "cross_filters": [],
          "limit": 0,
          "time_grain": "",
          "category": ""
        };

        const response = await apiClient.post(' /api/solarpanelcleaning/get_solar_dashboard_summary', payload);

        if (response && response.data) {
          const capacity = response.data.total_installed_capacity;
          setInstalledCapacity(capacity ? capacity.toString() : '0');
        }
      } catch (error) {
        console.error('Failed to fetch installed capacity:', error);
        setInstalledCapacity('0');
      } finally {
        setIsLoadingCapacity(false);
      }
    };

    fetchInstalledCapacity();
  }, [zone, dateFilter, refreshKey, selectedPlant, selectedLocation, bu]);

  // Fetch Energy Generated
  useEffect(() => {
    const fetchEnergyGenerated = async () => {
      try {
        setIsLoadingEnergy(true);
        setIsLoadingEfficiency(true);
        const filterValue = getDateFilterValue(dateFilter);
        
        const apiBU = bu === 'TAS' ? 'SOD' : (bu || 'SOD');
        const payload = {
          "bu": apiBU,
          "action": "get_energy_generated",
          "filters": [
            {"key":"bu","cond":"=","value": apiBU},
            {"key":"timestamp_ist","cond":"date_filter","value": filterValue},
            ...(zone ? [{"key":"zone","cond":"=","value": Array.isArray(zone) ? zone[0]?.toUpperCase() : zone.toUpperCase()}] : []),
            ...(selectedPlant ? [{"key":"sap_id","cond":"=","value": selectedPlant}] : []),
            ...(selectedLocation ? [{"key":"location_name","cond":"=","value": selectedLocation}] : [])
          ],
          "drill_state": "",
          "cross_filters": [],
          "limit": 0,
          "time_grain": "",
          "category": ""
        };

        const response = await apiClient.post(' /api/solarpanelcleaning/get_solar_dashboard_summary', payload);

        if (response && response.data) {
          const actual = response.data.actual_energy || '0';
          const estimated = response.data.estimated_energy || '0';
          setEnergyGenerated({
            actual: actual.toString(),
            estimated: estimated.toString()
          });

          // Extract efficiency percentage for the third card
          const efficiency = response.data.efficiency_percentage;
          setAvgEfficiency(efficiency ? efficiency.toString() : '0');
          setIsLoadingEfficiency(false);
        }
      } catch (error) {
        console.error('Failed to fetch energy generated:', error);
        setEnergyGenerated({ actual: '0', estimated: '0' });
        setAvgEfficiency('0');
      } finally {
        setIsLoadingEnergy(false);
        setIsLoadingEfficiency(false);
      }
    };

    fetchEnergyGenerated();
  }, [zone, dateFilter, refreshKey, selectedPlant, selectedLocation, bu]);

  // Fetch Active / Total Plants
  useEffect(() => {
    const fetchActiveTotalPlants = async () => {
      try {
        setIsLoadingPlants(true);
        const filterValue = getDateFilterValue(dateFilter);

        const apiBU = bu === 'TAS' ? 'SOD' : (bu || 'SOD');
        const payload = {
          "bu": apiBU,
          "action": "get_active_inactive_total_plants",
          "filters": [
            {"key":"bu","cond":"=","value": apiBU},
            {"key":"timestamp_ist","cond":"date_filter","value": filterValue},
            ...(zone ? [{"key":"zone","cond":"=","value": Array.isArray(zone) ? zone[0]?.toUpperCase() : zone.toUpperCase()}] : []),
            ...(selectedPlant ? [{"key":"sap_id","cond":"=","value": selectedPlant}] : []),
            ...(selectedLocation ? [{"key":"location_name","cond":"=","value": selectedLocation}] : [])
          ],
          "drill_state": "",
          "cross_filters": [],
          "limit": 0,
          "time_grain": "",
          "category": ""
        };

        const response = await apiClient.post(' /api/solarpanelcleaning/get_solar_dashboard_summary', payload);

        if (response && response.data) {
          const active = response.data.active_plants || '0';
          const inactive = response.data.inactive_plants || '0';
          const notConnected = response.data.not_connected_plants ?? '0';
          const total = response.data.total_plants || '0';
          const critical = response.data.critical_plants || '0';
          const plantsList = response.data.active_plants_list || [];
          const inactiveList = response.data.inactive_plants_list || [];
          const notConnectedList = response.data.not_connected_plants_list || [];
          setActiveTotalPlants({
            active: active.toString(),
            inactive: inactive.toString(),
            notConnected: notConnected.toString(),
            total: total.toString(),
            critical: critical.toString()
          });
          setActivePlantsList(plantsList);
          setInactivePlantsList(inactiveList);
          setNotConnectedPlantsList(notConnectedList);
        }
      } catch (error) {
        console.error('Failed to fetch active total plants:', error);
        setActiveTotalPlants({ active: '0', inactive: '0', notConnected: '0', total: '0', critical: '0' });
      } finally {
        setIsLoadingPlants(false);
      }
    };

    fetchActiveTotalPlants();
  }, [zone, dateFilter, refreshKey, selectedPlant, selectedLocation, bu]);

  // Update the Energy Generated title based on date filter
  const getEnergyGeneratedTitle = () => {
    // Handle object type (custom date range)
    if (dateFilter && typeof dateFilter === 'object') {
      return 'Energy Generated (Custom)';
    }

    // Handle string type
    if (typeof dateFilter === 'string') {
      const titleMap: { [key: string]: string } = {
        't': 'Energy Generated (Today)',
        'tdy': 'Energy Generated (Today)',
        '1d': 'Energy Generated (Yesterday)',
        'ydy': 'Energy Generated (Yesterday)',
        '1w': 'Energy Generated (1 Week)',
        '15d': 'Energy Generated (15 Days)',
        '1m': 'Energy Generated (1 Month)',
        '3m': 'Energy Generated (3 Months)',
        'custom': 'Energy Generated (Custom)'
      };
      return titleMap[dateFilter.toLowerCase()] || 'Energy Generated (Today)';
    }

    return 'Energy Generated (Today)';
  };

  const kpiData = [
    {
      title: 'Total Installed Capacity',
      value: installedCapacity,
      unit: 'KW',
      bgColor: 'bg-gradient-to-br from-[#4E56C0] to-[#6366F1]',
      textColor: 'text-white',
      titleColor: 'text-purple-200',
      icon: SolarPanel,
      iconColor: 'text-white',
      progress: 95,
      progressColor: 'bg-white',
    },
    {
      title: getEnergyGeneratedTitle(),
      bgColor: 'bg-gradient-to-br from-[#9B5DE0] to-[#A855F7]',
      textColor: 'text-white',
      titleColor: 'text-white-200',
      icon: Activity,
      iconColor: 'text-white',
      progress: 75,
      progressColor: 'bg-white',
      actualVsEstimated: {
        actual: energyGenerated.actual,
        estimated: energyGenerated.estimated,
      },
    },
    {
      title: 'Avg Plant Efficiency (Active)',
      value: avgEfficiency,
      unit: '%',
      bgColor: 'bg-gradient-to-br from-[#06B6D4] to-[#0891B2]',
      textColor: 'text-white',
      titleColor: 'text-blue-200',
      icon: CheckCircle2,
      iconColor: 'text-white',
      progress: parseFloat(avgEfficiency) || 92,
      progressColor: 'bg-white',
    },
    {
      title: 'Total Plants',
      value: activeTotalPlants.total,
      bgColor: 'bg-gradient-to-br from-[#10B981] to-[#059669]',
      textColor: 'text-white',
      titleColor: 'text-green-200',
      icon: AlertTriangle,
      iconColor: 'text-white',
      isPlantStatus: true,
      plantStatus: {
        active: activeTotalPlants.active,
        inactive: activeTotalPlants.inactive,
        notConnected: activeTotalPlants.notConnected,
      },
    },
  ];

  return (
    <>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {kpiData.map((kpi, index) => {
        const IconComponent = kpi.icon;
          const isEnergyGenerated = kpi.title.includes('Energy Generated');
          const isTotalCapacity = kpi.title.includes('Total Installed Capacity');
          const isEfficiency = kpi.title.includes('Avg Plant Efficiency');
        return (
          <div
            key={index}
            className={`${kpi.bgColor} rounded-xl p-3 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-start ${isEnergyGenerated ? 'overflow-visible' : 'overflow-hidden'} text-white relative`}
          >
            {isEnergyGenerated && 'actualVsEstimated' in kpi ? (
              <>
                <div className="flex items-center justify-between mb-1">
                    <p className={`text-xs text-white font-bold leading-tight`}>
                      {kpi.title}
                  </p>
                  <IconComponent className={`h-4 w-4 ${kpi.iconColor} flex-shrink-0`} />
                </div>
                  <div className="text-xs flex-1 flex flex-col justify-start leading-tight gap-1">
                  <div className="flex items-center justify-between">
                      <span className={`${kpi.textColor} font-bold`}>Actual:</span>
                      {isLoadingEnergy ? (
                        <span className="inline-block h-4 w-12 bg-white/30 rounded-md animate-pulse"></span>
                      ) : (
                        <span className={`${kpi.textColor} font-black`}>{kpi.actualVsEstimated.actual} KWH</span>
                      )}
                  </div>
                  <div className="flex items-center justify-between">
                      <span className={`${kpi.textColor} font-bold`}>Estimated:</span>
                      {isLoadingEnergy ? (
                        <span className="inline-block h-4 w-12 bg-white/30 rounded-md animate-pulse"></span>
                      ) : (
                        <span className={`${kpi.textColor} font-black`}>{kpi.actualVsEstimated.estimated} KWH</span>
                      )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-1">
                    <p className={`text-xs text-white font-bold`}>
                    {'isPlantStatus' in kpi && kpi.isPlantStatus && 'plantStatus' in kpi
                      ? `${kpi.title} (${kpi.value})`
                      : kpi.title}
                  </p>
                  <IconComponent className={`h-5 w-5 ${kpi.iconColor}`} />
                </div>
                  {'isPlantStatus' in kpi && kpi.isPlantStatus && 'plantStatus' in kpi ? (
                    <>
                      <div className="flex items-center gap-1 w-full justify-center mt-0.5">
                        <div className="flex-1 flex flex-col items-center justify-center min-w-0">
                          <div className={`text-[11px] font-medium ${kpi.textColor} mb-0.5 leading-tight opacity-90`}>Active</div>
                          {isLoadingPlants ? (
                            <span className="inline-block h-5 w-8 bg-white/30 rounded-md animate-pulse"></span>
                          ) : (
                            <div
                              className={`text-sm font-bold ${kpi.textColor} leading-tight cursor-pointer hover:underline`}
                              onClick={() => setShowPlantsTable(!showPlantsTable)}
                            >
                              {kpi.plantStatus.active}
                            </div>
                          )}
                        </div>
                        <div className="h-6 w-px bg-gray-300 flex-shrink-0"></div>
                        <div className="flex-1 flex flex-col items-center justify-center min-w-0">
                          <div className={`text-[11px] font-medium ${kpi.textColor} mb-0.5 leading-tight opacity-90`}>Inactive</div>
                          {isLoadingPlants ? (
                            <span className="inline-block h-5 w-8 bg-white/30 rounded-md animate-pulse"></span>
                          ) : (
                            <div
                              className={`text-sm font-bold ${kpi.textColor} leading-tight cursor-pointer hover:underline`}
                              onClick={() => setShowInactivePlantsTable(!showInactivePlantsTable)}
                            >
                              {kpi.plantStatus.inactive}
                            </div>
                          )}
                        </div>
                        <div className="h-6 w-px bg-gray-300 flex-shrink-0"></div>
                        <div className="flex-1 flex flex-col items-center justify-center min-w-0">
                          <div className={`text-[11px] font-medium ${kpi.textColor} mb-0.5 leading-tight opacity-90`}>Not Connected</div>
                          {isLoadingPlants ? (
                            <span className="inline-block h-5 w-8 bg-white/30 rounded-md animate-pulse"></span>
                          ) : (
                            <div
                              className={`text-sm font-bold ${kpi.textColor} leading-tight cursor-pointer hover:underline`}
                              onClick={() => setShowNotConnectedPlantsTable(!showNotConnectedPlantsTable)}
                            >
                              {kpi.plantStatus.notConnected}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className={`text-sm font-black ${kpi.textColor}`}>
                      {(isTotalCapacity && isLoadingCapacity) || (isEfficiency && isLoadingEfficiency) ? (
                        <span className="inline-block h-5 w-16 bg-white/30 rounded-md animate-pulse"></span>
                      ) : (
                        <>{kpi.value} {kpi.unit}</>
                      )}
                    </p>
                  )}
                {'change' in kpi && kpi.change && 'changeLabel' in kpi && (
                  <p className={`text-xs ${kpi.textColor} font-medium opacity-90`}>
                    {String(kpi.change)} {String(kpi.changeLabel)}
                  </p>
                )}
                {'additional' in kpi && kpi.additional && Array.isArray(kpi.additional) && (
                  <>
                    {kpi.additional.map((item: any, idx: number) => (
                      <p key={idx} className={`text-xs ${kpi.textColor} font-medium opacity-90`}>
                        {item.label}: {item.value}
                      </p>
                    ))}
                  </>
                )}
                {/* {kpi.critical && (
                  <p className={`text-xs ${kpi.textColor} font-medium opacity-90`}>
                    {kpi.critical}
                  </p>
                )} */}
              </>
            )}
          </div>
        );
      })}
    </div>

      {/* Active Plants Modal */}
      {showPlantsTable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-md font-bold text-gray-900">Active Plants Details</h3>
                <div className="flex items-center gap-3">
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-3 w-4" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={plantsSearchTerm}
                      onChange={(e) => setPlantsSearchTerm(e.target.value)}
                      className="pl-8 pr-3 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-32"
                    />
                  </div>
                  <button
                    onClick={closePlantsModal}
                    className="text-gray-500 hover:text-gray-700 p-1"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4">
              {activePlantsList.length > 0 ? (
                <>
                  {/* Fixed Height Table Container */}
                  <div className="overflow-auto max-h-96">
                    <table className="w-full border-collapse table-auto min-w-[300px]">
                      <thead className="bg-blue-100 sticky top-0">
                        <tr className="border-b-2 border-gray-200">
                          <th className="text-left py-1.5 px-3 font-semibold text-xs text-gray-700 w-24">Plant Code</th>
                          <th className="text-left py-1.5 px-3 font-semibold text-xs text-gray-700 pl-12">Location Name</th>
                          <th className="text-left py-1.5 px-3 font-semibold text-xs text-gray-700 whitespace-nowrap"> Capacity (KW)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getPlantsPaginatedData(plantsCurrentPage, plantsItemsPerPage).map((plant, index) => (
                          <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-1.5 px-3 text-xs text-gray-900 whitespace-nowrap font-medium">
                              {plant.PLANT_CD}
                            </td>
                            <td className="py-1.5 px-3 text-xs text-gray-900 pl-12">
                              {plant.LocationName}
                            </td>
                            <td className="py-1.5 px-3 text-xs text-gray-900">
                              {plant.Plant_Capacity ?? 130.0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Page Size Selector and Pagination */}
                  <div className="flex flex-col gap-2 mt-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">Show</span>
                        <select
                          value={plantsItemsPerPage}
                          onChange={(e) => handlePlantsItemsPerPageChange(Number(e.target.value))}
                          className="px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                        </select>
                        <span className="text-xs text-gray-600">entries</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handlePlantsPageChange(plantsCurrentPage - 1)}
                          disabled={plantsCurrentPage === 1}
                          className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300"
                        >
                          Previous
                        </button>

                        <span className="text-xs text-gray-600 px-1">
                          {plantsCurrentPage} of {getPlantsTotalPages(plantsItemsPerPage)}
                        </span>

                        <button
                          onClick={() => handlePlantsPageChange(plantsCurrentPage + 1)}
                          disabled={plantsCurrentPage === getPlantsTotalPages(plantsItemsPerPage)}
                          className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300"
                        >
                          Next
                        </button>
                      </div>
                    </div>

                    <div className="text-xs text-gray-600 text-center">
                      Showing {((plantsCurrentPage - 1) * plantsItemsPerPage) + 1} to {Math.min(plantsCurrentPage * plantsItemsPerPage, filteredPlantsData.length)} of {filteredPlantsData.length} entries
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-500">No active plants data available.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inactive Plants Modal */}
      {showInactivePlantsTable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-md font-bold text-gray-900">Inactive Plants Details</h3>
                <div className="flex items-center gap-3">
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-3 w-4" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={inactivePlantsSearchTerm}
                      onChange={(e) => setInactivePlantsSearchTerm(e.target.value)}
                      className="pl-8 pr-3 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-32"
                    />
                  </div>
                  <button
                    onClick={closeInactivePlantsModal}
                    className="text-gray-500 hover:text-gray-700 p-1"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4">
              {inactivePlantsList.length > 0 ? (
                <>
                  {/* Fixed Height Table Container */}
                  <div className="overflow-auto max-h-96">
                    <table className="w-full border-collapse table-auto min-w-[300px]">
                      <thead className="bg-blue-100 sticky top-0">
                        <tr className="border-b-2 border-gray-200">
                          <th className="text-left py-1.5 px-3 font-semibold text-xs text-gray-700 w-24">Plant Code</th>
                          <th className="text-left py-1.5 px-3 font-semibold text-xs text-gray-700 pl-12">Location Name</th>
                          <th className="text-left py-1.5 px-3 font-semibold text-xs text-gray-700">Capacity (KW)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getInactivePlantsPaginatedData(inactivePlantsCurrentPage, inactivePlantsItemsPerPage).map((plant, index) => (
                          <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-1.5 px-3 text-xs text-gray-900 whitespace-nowrap font-medium">
                              {plant.PLANT_CD}
                            </td>
                            <td className="py-1.5 px-3 text-xs text-gray-900 pl-12">
                              {plant.LocationName}
                            </td>
                            <td className="py-1.5 px-3 text-xs text-gray-900 whitespace-nowrap ">
                              {plant.Plant_Capacity ?? 130.0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Page Size Selector and Pagination */}
                  <div className="flex flex-col gap-2 mt-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">Show</span>
                        <select
                          value={inactivePlantsItemsPerPage}
                          onChange={(e) => handleInactivePlantsItemsPerPageChange(Number(e.target.value))}
                          className="px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                        </select>
                        <span className="text-xs text-gray-600">entries</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleInactivePlantsPageChange(inactivePlantsCurrentPage - 1)}
                          disabled={inactivePlantsCurrentPage === 1}
                          className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300"
                        >
                          Previous
                        </button>

                        <span className="text-xs text-gray-600 px-1">
                          {inactivePlantsCurrentPage} of {getInactivePlantsTotalPages(inactivePlantsItemsPerPage)}
                        </span>

                        <button
                          onClick={() => handleInactivePlantsPageChange(inactivePlantsCurrentPage + 1)}
                          disabled={inactivePlantsCurrentPage === getInactivePlantsTotalPages(inactivePlantsItemsPerPage)}
                          className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300"
                        >
                          Next
                        </button>
                      </div>
                    </div>

                    <div className="text-xs text-gray-600 text-center">
                      Showing {((inactivePlantsCurrentPage - 1) * inactivePlantsItemsPerPage) + 1} to {Math.min(inactivePlantsCurrentPage * inactivePlantsItemsPerPage, filteredInactivePlantsData.length)} of {filteredInactivePlantsData.length} entries
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-500">No inactive plants data available.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Not Connected Plants Modal */}
      {showNotConnectedPlantsTable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-md font-bold text-gray-900">Not Connected Plants Details</h3>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-3 w-4" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={notConnectedPlantsSearchTerm}
                      onChange={(e) => setNotConnectedPlantsSearchTerm(e.target.value)}
                      className="pl-8 pr-3 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-32"
                    />
                  </div>
                  <button
                    onClick={closeNotConnectedPlantsModal}
                    className="text-gray-500 hover:text-gray-700 p-1"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4">
              {notConnectedPlantsList.length > 0 ? (
                <>
                  <div className="overflow-auto max-h-96">
                    <table className="w-full border-collapse table-auto min-w-[300px]">
                      <thead className="bg-blue-100 sticky top-0">
                        <tr className="border-b-2 border-gray-200">
                          <th className="text-left py-1.5 px-3 font-semibold text-xs text-gray-700 w-24">Plant Code</th>
                          <th className="text-left py-1.5 px-3 font-semibold text-xs text-gray-700 pl-12">Location Name</th>
                          <th className="text-left py-1.5 px-3 font-semibold text-xs text-gray-700 whitespace-nowrap">Capacity (KW)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getNotConnectedPlantsPaginatedData(notConnectedPlantsCurrentPage, notConnectedPlantsItemsPerPage).map((plant, index) => (
                          <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-1.5 px-3 text-xs text-gray-900 whitespace-nowrap font-medium">
                              {plant.PLANT_CD}
                            </td>
                            <td className="py-1.5 px-3 text-xs text-gray-900 pl-12">
                              {plant.LocationName}
                            </td>
                            <td className="py-1.5 px-3 text-xs text-gray-900">
                              {plant.Plant_Capacity ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col gap-2 mt-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">Show</span>
                        <select
                          value={notConnectedPlantsItemsPerPage}
                          onChange={(e) => handleNotConnectedPlantsItemsPerPageChange(Number(e.target.value))}
                          className="px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                        </select>
                        <span className="text-xs text-gray-600">entries</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleNotConnectedPlantsPageChange(notConnectedPlantsCurrentPage - 1)}
                          disabled={notConnectedPlantsCurrentPage === 1}
                          className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300"
                        >
                          Previous
                        </button>

                        <span className="text-xs text-gray-600 px-1">
                          {notConnectedPlantsCurrentPage} of {getNotConnectedPlantsTotalPages(notConnectedPlantsItemsPerPage)}
                        </span>

                        <button
                          onClick={() => handleNotConnectedPlantsPageChange(notConnectedPlantsCurrentPage + 1)}
                          disabled={notConnectedPlantsCurrentPage === getNotConnectedPlantsTotalPages(notConnectedPlantsItemsPerPage)}
                          className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300"
                        >
                          Next
                        </button>
                      </div>
                    </div>

                    <div className="text-xs text-gray-600 text-center">
                      Showing {((notConnectedPlantsCurrentPage - 1) * notConnectedPlantsItemsPerPage) + 1} to {Math.min(notConnectedPlantsCurrentPage * notConnectedPlantsItemsPerPage, filteredNotConnectedPlantsData.length)} of {filteredNotConnectedPlantsData.length} entries
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-500">No not connected plants data available.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CEMSKPICards;