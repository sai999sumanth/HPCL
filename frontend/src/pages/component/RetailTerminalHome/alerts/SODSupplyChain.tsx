import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/@/components/ui/card";
import { Button } from '@/@/components/ui/button';
import { VisuallyHidden } from '@chakra-ui/react';
import axios from 'axios';
import { Checkbox } from '@/@/components/ui/checkbox';
import { CustomMultiSelect } from '@/@/components/ui/custom-multiselect';
import { useOutletStore } from '@/store/useOutletStore';
import { useDryout } from '@/providers/DryoutProvider';
import { useOutletStats } from '@/store/usOutletStats';
import { useSODStore } from '@/store/useFilterStore';
import ApiLoader from '@/services/apiLoader';
import { GlobalFilterProvider } from '@/pages/custom-dashboard/GlobalFilter';
import { DashboardProvider } from '@/pages/custom-dashboard/context/DashboardContext';
import { transformChartData } from '@/pages/custom-dashboard/status-tracker/utils';
import { Skeleton } from '@/@/components/ui/skeleton';
import WorkflowDiagram from '@/pages/custom-dashboard/dryout-workfow/WorkflowDiagram';
import { SVGSkeleton } from '@/pages/custom-dashboard/charts/Skeleton';
import StatusTracker from '@/pages/custom-dashboard/status-tracker/StatusTracker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/@/components/ui/tabs';
import { Tabs as CTabs, TabList as CTabList, TabPanels as CTabPanels, Tab as CTab, TabPanel as CTabPanel } from "@chakra-ui/react";
import ROAlertsTableV2 from '../../alertsTable/AlertTableV2';
import SupplyChainReport from '../../supplychain-report';
import { apiClient } from '@/services/apiClient';
import { RotateCcw, X } from 'lucide-react';

export function SODSupplyChainComponent() {
  const [stateData, setStateData] = useState<any>([]);
  const [areaData, setAreaData] = useState<any>([]);
  const [category, setCategory] = useState<boolean>(false);
  const [dryoutRO, setDryoutRO] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState(0);
  const [fixedDryoutCount, setFixedDryoutCount] = useState<any>([]);
  const [selected, setSelected] = useState('DRY OUT');
  const [dryoutVisibleItem, setDryoutVisibleItem] = useState<any>('DRY OUT');
  const [activeTab, setActiveTab] = useState(0);
  const [loadedTabs, setLoadedTabs] = useState<Set<number>>(new Set([0]));
  const [activeTabValue, setActiveTabValue] = useState("dryout");
  const [resetKey, setResetKey] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [initialLoadStarted, setInitialLoadStarted] = useState(false);

  let {
    chartData,
    topData,
    bottomData,
    roleLength,
    fetchOutletData,
    fetchOutletFilters,
    fetchDryOutCount,
    zoneData,
    plantData,
    regionData,
    productData,
    customerData,
    dryoutCount,
    isLoadingData,
  } = useOutletStore();
  // SOD Supply Chain only: actions initial_steps, carry_fwd_indent, pending_carry_fwd_indent, dealer_truck_count. Do NOT use tar_analysis or dry_out_analysis here.
  const {
    initialStepsNumbers,
    carryFwdIndentNumbers,
    pendingCarryFwdIndentNumbers,
    dealerTruckCountNumbers,
    fetchInitialStepsStats,
    fetchCarryFwdIndentStats,
    fetchPendingCarryFwdIndentStats,
    fetchDealerTruckCountStats,
    isLoadingInitialSteps,
    isLoadingCarryFwdIndent,
    isLoadingPendingCarryFwdIndent,
    isLoadingDealerTruckCount,
    setBuType
  } = useOutletStats();
  const {
    sodZoneName,
    sodPlantName,
    sodProductName,
    sodCustomerName,
    retailZoneName,
    retailRegionName,
    retailAreaName,
    retailCustomerName,
    categoryValue,
    progressRate,
    getAllStoredData,
    resetStoredData,
    setComponentContext,
    isLoadingstoreData,

  } = useSODStore();
  const { selectedDryout, dryoutData, handleDryoutSelection, isLoading, error } = useDryout();
  const location = useLocation();
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('sodTerminal') && path.includes('sodSupplychain')) setBuType('sod');
    else if (path.includes('retailOutlet') && path.includes('SupplyChain')) setBuType('ro');
  }, [location.pathname, setBuType]);
  const SODHandleChange = useSODStore(state => state.SODHandleChange);
  const ProductName = useSODStore(state => state.sodProductName);

  // Guard: run initial load only once (avoids double load from Strict Mode or re-mount), same as RO
  const initialLoadRunRef = useRef(false);

  useEffect(() => {
    if (initialLoadRunRef.current) return;
    initialLoadRunRef.current = true;

    const initialProducts = ["2811000", "2812000", "2822000"];
    SODHandleChange(initialProducts, "productName");

    const MIN_LOADING_MS = 2000; // Keep loader visible at least 2s so UI shows once (no double-load flash), same as RO
    const initLoad = async () => {
      setInitialLoadStarted(true);
      const loadStart = Date.now();
      try {
        // Load all SOD APIs at one go: dryout count (big cards), location details (filters), handleDryoutSelection (outlet data + 4 stats)
        await Promise.allSettled([
          getDryoutCount().catch(err => console.warn('[SOD] getDryoutCount failed:', err)),
          getDistinctLocationDetails("TAS").catch(err => console.warn('[SOD] getDistinctLocationDetails failed:', err)),
          handleDryoutSelection("DRY OUT", 0, 'firstTime').catch(err => console.warn('[SOD] handleDryoutSelection failed:', err))
        ]);
      } catch (error) {
        console.error('[SOD] Initial load error:', error);
      } finally {
        const elapsed = Date.now() - loadStart;
        const wait = Math.max(0, MIN_LOADING_MS - elapsed);
        setTimeout(() => setIsInitialLoading(false), wait);
      }
    };

    initLoad();
  }, []);

  // Safety: force hide loading after 15s to prevent infinite loading (same as RO)
  useEffect(() => {
    if (!initialLoadStarted) return;
    const t = setTimeout(() => setIsInitialLoading(false), 15000);
    return () => clearTimeout(t);
  }, [initialLoadStarted]);

  // Also, update the useEffect to not override empty product arrays:
  // useEffect(() => {
  // // Set this as the SOD component - this clears retail filters automatically
  //   // SODHandleChange('SOD', 'componentType');
  //   // getDistinctLocationDetails('TAS');
  //   // getDryoutCount();
  //   // handleDryoutSelection('DRY OUT', 0);
  //   // Set initial product selection only if sodProductName is undefined or null
  //   const initialProducts: any = ["2811000", "2812000", "2822000"]; // IDs for MS, HSD, E20

  //   // Only set initial products if sodProductName is not yet defined
  //   // if (sodProductName === undefined || sodProductName === null || sodProductName.length === 0) {
  //   SODHandleChange(initialProducts, "productName");
  //   // handleFilterChange(initialProducts, "productName");
  //   // }

  //   // const filterParams = getAllStoredData();
  //   // if(filterParams.sodProductName && filterParams.sodProductName?.length === 0) {
  //   //   SODHandleChange(initialProducts, "productName");
  //   // }
  //   // // filterParams.sodProductName = initialProducts
  //   // console.log("filterParams prod", filterParams);

  //   // Always fetch with the product filter respecting user selection
  //   // If sodProductName has a value (even empty array), use it exactly as is
  //   // fetchDryOutCount({
  //   //   type: 'filterByIndent',
  //   //   filters: {
  //   //     sodProductName: Array.isArray(sodProductName) ? sodProductName : initialProducts
  //   //   }
  //   // });
  //   setTimeout(() => {
  //     getDistinctLocationDetails('TAS');
  //     getDryoutCount();
  //     handleDryoutSelection('DRY OUT', 0);
  //   }, 1000);
  // }, []);


  const initialDryOutMount = async () => {
    try {
      const initialProducts = ["2811000", "2812000", "2822000"];
      await fetchOutletData({
        type: 'filterByAll',
        filters: {
          dryout: { serial: 1 },
          sodProductName: sodProductName !== undefined && sodProductName !== null
            ? sodProductName  // Use whatever it has, even empty array
            : ["2811000", "2812000", "2822000"],
          // Include empty arrays for retail fields to ensure they're not used
          // retailZoneName: [],
          retailRegionName: [],
          retailAreaName: [],
          retailCustomerName: []
        }
      });
    } catch (error) {
      console.error('Error fetching outlet data:', error);
    }
  }
  const buildDynamicQuery = (isClosedTab = false) => {
    // Start with the base query
    let query = `bu='RO' AND interlock_name='Dry Out Each Indent Wise MainFlow' AND mark_as_false='true'`;

    // Add status condition based on tab
    if (isClosedTab) {
      query += ` AND alert_status='Close'`;
    } else {
      query += ` AND alert_status!='Close'`;
    }

    // Add filters if they exist
    if (sodZoneName?.length > 0) {
      query += ` AND zone IN ('${sodZoneName.join("','")}')`;
    }

    if (sodPlantName?.length > 0) {
      query += ` AND sap_id IN ('${sodPlantName.join("','")}')`;
    }

    if (sodCustomerName?.length > 0) {
      query += ` AND dealer_id IN ('${sodCustomerName.join("','")}')`;
    }

    if (sodProductName?.length > 0) {
      query += ` AND product_code IN ('${sodProductName.join("','")}')`;
    }

    if (categoryValue?.length > 0) {
      query += ` AND category IN ('${categoryValue.join("','")}')`;
    }

    if (selectedDryout && selectedDryout.index !== undefined) {
      query += ` AND dry_out_in_days='${selectedDryout.index + 1}'`;
    }

    return query;
  };
  const fetchFilterData = async (requestParameter, filters, bu = 'RO') => {
    const params = {
      request_parameter: requestParameter,
      bu: bu,
      filters: filters,
    };

    try {
      const response = await apiClient.post('/api/indentdryout/get_filtered_location_data', params);
      if (response && response.data.status === true) {
        return response.data.data; // Assuming data contains the necessary values
      }
      return [];
    } catch (error) {
      console.error(`Failed to fetch data for ${requestParameter}`, error);
      return [];
    }
  };

  const getDistinctLocationDetails = async (type, filters?) => {
    try {
      await fetchOutletFilters({
        type: type,
        filters: {
          sodZoneName: filters?.sodZoneName,
          sodPlantName: filters?.sodPlantName
        }
      });
    } catch (error) {
      throw new Error('Failed to fetch Distinct location details');
    }
  }


  const handleResetAllFilters = async () => {
    const initialProducts = ["2811000", "2812000", "2822000"];

    // Set resetting flag to prevent useEffect from triggering
    setIsResetting(true);

    // Reset all filter states
    setSelected('');
    setActiveFilter(null);
    setCategory(false);
    setDryoutRO(false);

    // Increment reset key to force remount of CustomMultiSelect components
    setResetKey(prev => prev + 1);

    // Reset all filters in the store
    SODHandleChange([], "zoneName");
    SODHandleChange([], "regionName");
    SODHandleChange([], "areaName");
    SODHandleChange([], "customerName");
    SODHandleChange(initialProducts, "productName");
    SODHandleChange(null, "categoryValue");

    // Reset dryout selection to first item (DRY OUT) - skip API calls since we'll call them in setTimeout
    if (fixedDryoutCount.length > 0) {
      handleDryoutSelection("DRY OUT", 0, undefined, true);
    }

    // Reset stored data
    resetStoredData();

    setTimeout(async () => {
      const filters = {
        sodProductName: initialProducts,
        sodZoneName: [],
        sodCustomerName: [],
        retailRegionName: [],
        retailAreaName: [],
        retailCustomerName: [],
        categoryValue: null,
        dryout: { serial: 1 }
      };

      await Promise.all([
        fetchOutletData({
          type: 'filterByAll',
          filters: filters
        }),
        fetchInitialStepsStats({
          type: 'filterByAll',
          filters: {
            ...filters,
            dryout: { serial: null }
          }
        }),
        fetchCarryFwdIndentStats({
          type: 'filterByAll',
          filters: { ...filters, dryout: { serial: null } }
        }),
        fetchPendingCarryFwdIndentStats({
          type: 'filterByAll',
          filters: { ...filters, dryout: { serial: null } }
        }),
        fetchDealerTruckCountStats({
          type: 'filterByAll',
          filters: { ...filters, dryout: { serial: null } }
        }),
        fetchDryOutCount({
          type: 'filterByAll',
          filters: filters
        }),
        getDistinctLocationDetails('TAS'),
        getDryoutCount()
      ]);

      // Clear resetting flag after API calls complete
      setIsResetting(false);
    }, 500);
  }

  const numbers = Array.from({ length: roleLength }, (_, index) => index + 1);

  // Create fetchData as a memoized function
  const fetchData = useCallback(async (type, updates = {}) => {
    // Don't fetch if we're in the middle of a reset
    if (isResetting) {
      return;
    }

    // Get filters based on current component context
    const filterParams = getAllStoredData();

    // Add any immediate updates
    const mergedFilters = {
      ...filterParams,
      ...updates
    };

    // Call all four APIs independently to ensure all are called even if one fails
    const initialStepsApiCall = fetchInitialStepsStats({
      type: 'filterByIndent',
      filters: {
        ...mergedFilters,
        dryout: { serial: null }
      }
    }).catch(err => {
      console.error('❌ fetchInitialStepsStats failed:', err);
      return null;
    });

    const carryFwdApiCall = fetchCarryFwdIndentStats({
      type: 'filterByIndent',
      filters: { ...mergedFilters, dryout: { serial: null } }
    }).catch(err => {
      console.error('❌ fetchCarryFwdIndentStats failed:', err);
      return null;
    });
    const pendingCarryFwdApiCall = fetchPendingCarryFwdIndentStats({
      type: 'filterByIndent',
      filters: { ...mergedFilters, dryout: { serial: null } }
    }).catch(err => {
      console.error('❌ fetchPendingCarryFwdIndentStats failed:', err);
      return null;
    });
    const dealerTruckApiCall = fetchDealerTruckCountStats({
      type: 'filterByIndent',
      filters: { ...mergedFilters, dryout: { serial: null } }
    }).catch(err => {
      console.error('❌ fetchDealerTruckCountStats failed:', err);
      return null;
    });

    await Promise.all([
      fetchOutletData({
        type: 'filterByIndent',
        filters: mergedFilters,
      }),
      initialStepsApiCall,
      carryFwdApiCall,
      pendingCarryFwdApiCall,
      dealerTruckApiCall,
      fetchDryOutCount({
        type: 'filterByIndent',
        filters: mergedFilters
      }),
      getDistinctLocationDetails(type, mergedFilters),
      getDryoutCount()
    ]);
  }, [
    sodZoneName,
    sodPlantName,
    sodCustomerName,
    sodProductName,
    selectedDryout,
    progressRate,
    isResetting
  ]);


  const handleFilterChange = (event: any, name: string) => {

    console.log("selectedDryout", selectedDryout);
    // Ensure we pass the event directly, even if it's an empty array
    SODHandleChange(event, name);
    let allData = getAllStoredData();
    allData.selectedDryout = selectedDryout;
    // Debounce the fetch call
    const timeoutId = setTimeout(() => {
      // Pass the full state data to ensure empty arrays are respected
      fetchData('TAS', allData);
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  // Update the fetchData function to handle dryStatusChange

  const handleDryStatusFilterChange = (event: any, name: string) => {
    SODHandleChange(event, name);
    const allData = getAllStoredData();
    // Debounce the fetch call
    const timeoutId = setTimeout(() => {
      fetchDryStatusData(allData);
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  const getFilterHandler = (value, name) => {
    if (activeTabValue === 'dryStatusChange') {
      return (value) => handleDryStatusFilterChange(value, name);
    } else {
      return (value) => handleFilterChange(value, name);
    }
  };


  // Add a function to determine which filter handler to use based on the active tab
  const getActiveFilterHandler = () => {
    // You'll need to add state to track which tab is active
    const activeTabValue = document.querySelector('[role="tablist"] [data-state="active"]')?.getAttribute('value');

    if (activeTabValue === 'dryStatusChange') {
      return handleDryStatusFilterChange;
    } else {
      return handleFilterChange;
    }
  };

  const fetchDryStatusData = useCallback(async (updates = {}) => {
    const filterParams = {
      categoryValue: categoryValue,
      sodZoneName,
      sodPlantName,
      sodCustomerName,
      sodProductName,
      // retailZoneName,
      retailCustomerName,
      retailRegionName,
      retailAreaName,
      dryout_in_days: { serial: selectedDryout?.index + 1 },
      dryout: { serial: progressRate },
      ...updates  // Apply any immediate updates
    };

    await Promise.all([
      fetchOutletData({
        type: 'dryStatusChange',
        filters: filterParams,
      }),
      fetchInitialStepsStats({
        type: 'dryStatusChange',
        filters: {
          ...filterParams,
          dryout: { serial: null }
        }
      }),
      fetchCarryFwdIndentStats({
        type: 'dryStatusChange',
        filters: { ...filterParams, dryout: { serial: null } }
      }),
      fetchPendingCarryFwdIndentStats({
        type: 'dryStatusChange',
        filters: { ...filterParams, dryout: { serial: null } }
      }),
      fetchDealerTruckCountStats({
        type: 'dryStatusChange',
        filters: { ...filterParams, dryout: { serial: null } }
      }),
      fetchDryOutCount({
        type: 'dryStatusChange',
        filters: filterParams
      }),
      getDistinctLocationDetails('TAS', filterParams),
      getDryoutCount()
    ]);
  }, [
    sodZoneName,
    sodPlantName,
    sodCustomerName,
    sodProductName,
    // retailZoneName,
    retailCustomerName,
    retailRegionName,
    retailAreaName,
    selectedDryout,
    progressRate
  ]);


  const fetchRetailData = useCallback(async (updates = {}) => {
    // await getDistinctLocationDetails('retail');
    const filterParams = {
      categoryValue: categoryValue,
      sodZoneName,
      sodPlantName,
      sodCustomerName,
      sodProductName,
      // retailZoneName,
      retailCustomerName,
      retailRegionName,
      retailAreaName,
      dryout_in_days: { serial: selectedDryout?.index + 1 },
      dryout: { serial: progressRate },
      ...updates  // Apply any immediate updates
    };
    await Promise.all([
      fetchOutletData({
        type: 'filterByIndent',
        filters: filterParams,
      })
    ]);
  }, [
    sodZoneName,
    sodPlantName,
    sodCustomerName,
    sodProductName,
    // retailZoneName,
    retailCustomerName,
    retailRegionName,
    retailAreaName,
    selectedDryout,
    progressRate
  ]);

  const RetailHandleChange = async (event: any, name: string) => {
    let title = name;
    let value = event;

    SODHandleChange(event, name);

    const allData = getAllStoredData();
    // After change, you can get all current data

    console.log(allData);
    // Debounce the fetch call
    const timeoutId = setTimeout(() => {
      fetchRetailData(allData);
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  const statusTracker = transformChartData(chartData);

  const transformData = (jsonData) => {
    // Map of keys to display names and colors
    const mappings = {
      dry_out: {
        name: 'DRY OUT',
        color: 'red'
      },
      intraday_dry_out: {
        name: 'INTRA DAY DRY OUT',
        color: 'orange'
      },
      potential_dry_out: {
        name: 'Potential DRY OUT',
        color: 'blue'
      }
    };

    // Transform the data
    return Object.entries(jsonData).map(([key, value]) => ({
      name: mappings[key].name,
      count: value.toLocaleString(), // Formats number with commas
      color: mappings[key].color
    }));
  };

  const getDryoutCount = async () => {
    try {
      let params = {};
      let response = await apiClient.post('/api/indentdryout/get_dry_out_count', params);
      if (response.data?.status === true) {
        setFixedDryoutCount(transformData(response.data?.data));
      }

    } catch (error) {
      console.log(error)
    }
  }

  const handleDryStatusTabChange = () => {
    getDistinctLocationDetails('TAS');
    resetStoredData();

    // Initialize with the dryStatusChange parameter type
    setTimeout(async () => {
      await Promise.all([
        fetchOutletData({
          type: 'dryStatusChange',
          filters: {}
        }),
        fetchInitialStepsStats({
          type: 'dryStatusChange',
          filters: {}
        }),
        fetchCarryFwdIndentStats({
          type: 'dryStatusChange',
          filters: {}
        }),
        fetchPendingCarryFwdIndentStats({
          type: 'dryStatusChange',
          filters: {}
        }),
        fetchDealerTruckCountStats({
          type: 'dryStatusChange',
          filters: {}
        }),
        fetchDryOutCount({
          type: 'dryStatusChange',
          filters: {}
        })
      ]);
    }, 500);
  }

  const handleTabChange = (type) => {
    if (type === 'retail') {
      setActiveTabValue("retail");
      getDistinctLocationDetails('RO');
      resetStoredData();
    } else if (type === 'dryStatusChange') {
      setActiveTabValue("dryStatusChange");
      handleDryStatusTabChange();
    } else {
      setActiveTabValue("dryout");
      getDistinctLocationDetails('TAS');
      resetStoredData();

      // Reset and initialize the DRYOUT tab
      setTimeout(async () => {
        await Promise.all([
          fetchOutletData({
            type: 'filterByIndent', // Use 'filterByIndent' for the DRYOUT tab
            filters: {}
          }),
          fetchInitialStepsStats({
            type: 'filterByIndent',
            filters: {}
          }),
          fetchCarryFwdIndentStats({
            type: 'filterByIndent',
            filters: {}
          }),
          fetchPendingCarryFwdIndentStats({
            type: 'filterByIndent',
            filters: {}
          }),
          fetchDealerTruckCountStats({
            type: 'filterByIndent',
            filters: {}
          }),
          fetchDryOutCount({
            type: 'filterByIndent',
            filters: {}
          })
        ]);
      }, 500);
    }
  }

  const handleDryoutRefresh = async () => {
    // Get all current filter data to preserve selections
    const allData = getAllStoredData();
    allData.selectedDryout = selectedDryout;

    // Ensure all filter values are included
    const refreshFilters = {
      ...allData,
      sodZoneName: allData.sodZoneName || sodZoneName || [],
      sodProductName: allData.sodProductName || sodProductName || ["2811000", "2812000", "2822000"],
      sodCustomerName: allData.sodCustomerName || sodCustomerName || [],
      categoryValue: allData.categoryValue || categoryValue || null,
      selectedDryout: selectedDryout
    };

    try {
      await Promise.all([
        fetchOutletData({
          type: activeTabValue === 'dryStatusChange' ? 'dryStatusChange' : 'filterByIndent',
          filters: refreshFilters,
        }),
        fetchInitialStepsStats({
          type: activeTabValue === 'dryStatusChange' ? 'dryStatusChange' : 'filterByIndent',
          filters: {
            ...refreshFilters,
            dryout: { serial: null }
          }
        }),
        fetchCarryFwdIndentStats({
          type: activeTabValue === 'dryStatusChange' ? 'dryStatusChange' : 'filterByIndent',
          filters: { ...refreshFilters, dryout: { serial: null } }
        }),
        fetchPendingCarryFwdIndentStats({
          type: activeTabValue === 'dryStatusChange' ? 'dryStatusChange' : 'filterByIndent',
          filters: { ...refreshFilters, dryout: { serial: null } }
        }),
        fetchDealerTruckCountStats({
          type: activeTabValue === 'dryStatusChange' ? 'dryStatusChange' : 'filterByIndent',
          filters: { ...refreshFilters, dryout: { serial: null } }
        }),
        fetchDryOutCount({
          type: activeTabValue === 'dryStatusChange' ? 'dryStatusChange' : 'filterByIndent',
          filters: refreshFilters
        }),
        getDistinctLocationDetails('TAS', refreshFilters),
        getDryoutCount()
      ]);
    } catch (error) {
      console.error('Error refreshing DryOut tab data:', error);
    }
  }

  const handleCategoryChange = async (event) => {
    setCategory(event);
    const apiType = activeTabValue === 'dryStatusChange' ? 'dryStatusChange' : 'filterByIndent';

    if (event) {
      SODHandleChange(["R01"], 'categoryValue');

      setTimeout(async () => {
        const categoryFilters = {
          categoryValue: ["R01"],
          sodZoneName,
          sodPlantName,
          sodCustomerName,
          sodProductName,
          retailCustomerName,
          retailRegionName,
          retailAreaName,
          dryout_in_days: { serial: selectedDryout?.index + 1 },
          dryout: { serial: progressRate }
        };

        await Promise.all([
          fetchInitialStepsStats({
            type: apiType,
            filters: {
              ...categoryFilters,
              dryout: { serial: null }
            }
          }),
          fetchCarryFwdIndentStats({
            type: apiType,
            filters: { ...categoryFilters, dryout: { serial: null } }
          }),
          fetchPendingCarryFwdIndentStats({
            type: apiType,
            filters: { ...categoryFilters, dryout: { serial: null } }
          }),
          fetchDealerTruckCountStats({
            type: apiType,
            filters: { ...categoryFilters, dryout: { serial: null } }
          }),
          fetchOutletData({
            type: apiType,
            filters: categoryFilters
          }),
          fetchDryOutCount({
            type: apiType,
            filters: {
              ...categoryFilters,
              dryout: { serial: null }
            }
          })
        ]);
      }, 200);
    } else {
      SODHandleChange(null, 'categoryValue');

      const noCategoryFilters = {
        categoryValue: null,
        sodZoneName,
        sodPlantName,
        sodCustomerName,
        sodProductName,
        retailCustomerName,
        retailRegionName,
        retailAreaName,
        dryout_in_days: { serial: selectedDryout?.index + 1 },
        dryout: { serial: progressRate }
      };

      await Promise.all([
        fetchInitialStepsStats({
          type: apiType,
          filters: {
            ...noCategoryFilters,
            dryout: { serial: null }
          }
        }),
        fetchCarryFwdIndentStats({
          type: apiType,
          filters: { ...noCategoryFilters, dryout: { serial: null } }
        }),
        fetchPendingCarryFwdIndentStats({
          type: apiType,
          filters: { ...noCategoryFilters, dryout: { serial: null } }
        }),
        fetchDealerTruckCountStats({
          type: apiType,
          filters: { ...noCategoryFilters, dryout: { serial: null } }
        }),
        fetchOutletData({
          type: apiType,
          filters: noCategoryFilters
        }),
        fetchDryOutCount({
          type: apiType,
          filters: {
            ...noCategoryFilters,
            dryout: { serial: null }
          }
        })
      ]);
    }
  }
  useEffect(() => {
    // Set this as the SOD component
    SODHandleChange('SOD', 'componentType');

    // Rest of your initialization...
    const initialProducts = ["2811000", "2812000", "2822000"];
    SODHandleChange(initialProducts, "productName");

    // Clean up when unmounting
    return () => {
      // Reset all stored data
      resetStoredData();
    };
  }, []);
  const handleDryoutROChange = async (event, type) => {
    setDryoutRO(event);
    if (event) {
      let params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'dry_out_in_days', cond: '=', value: ["1"] },
        ]
      }
      try {
        const res = await apiClient.post('/api/indentdryout/get_distinct_ro_name', params);
        const { data } = res.data;
        if (res.data?.status === true) {
          customerData = data?.['customer'];
          plantData = data?.['plant'];
        }
      } catch (error) {
        console.log(error)
      }
    } else {
      if (type === 'sod') {
        getDistinctLocationDetails('sod');
      } else if (type === 'retail') {
        getDistinctLocationDetails('retail');
      }

    }
  }

  const toggleFilter = (name, index) => {
    setActiveFilter(activeFilter === index ? null : index);
    setDryoutVisibleItem(activeFilter === index ? null : name);
  }

  const handleAlertsTabChange = (index: number) => {
    setActiveTab(index);
    setLoadedTabs((prev) => new Set([...prev, index]));
  };

  const getFilterStyles = (color, isActive) => {
    const colorStyles = {
      red: {
        active: "border-red-400 bg-red-100 shadow-lg",
        inactive: "border-red-400 hover:shadow-lg hover:border-red-400 hover:bg-red-100",
        text: "text-red-900 font-bold text-lg"
      },
      orange: {
        active: "border-orange-400 bg-orange-100 shadow-lg",
        inactive: "border-orange-400 hover:shadow-lg hover:border-orange-400 hover:bg-orange-100",
        text: "text-orange-900 font-bold text-lg"
      },
      blue: {
        active: "border-blue-400 bg-blue-100 shadow-lg",
        inactive: "border-blue-400 hover:shadow-lg hover:border-blue-400 hover:bg-blue-100",
        text: "text-blue-900 font-bold text-lg"
      },
      purple: {
        active: "border-purple-400 bg-purple-100 shadow-lg",
        inactive: "border-purple-400 hover:shadow-lg hover:border-purple-400 hover:bg-purple-100",
        text: "text-purple-900 font-bold text-lg"
      }
    };

    const styles = colorStyles[color] || colorStyles.blue; // Default to blue if color not found
    return {
      container: isActive ? styles.active : styles.inactive,
      text: styles.text
    };
  };

  return (
    <>
      <GlobalFilterProvider>
        <DashboardProvider>
          <div className="space-y-1 w-full min-w-0 overflow-x-hidden">
            <Tabs defaultValue="dryout" className="w-full min-w-0">
              <div className="flex justify-between w-full">
                <TabsList className="grid w-full max-w-[20rem] grid-cols-2">
                  <TabsTrigger
                    value="dryout"
                    onClick={() => handleTabChange("sod")}
                  >
                    DRYOUT
                  </TabsTrigger>

                  <TabsTrigger
                    value="reports"
                    onClick={() => setActiveTabValue("reports")}
                  >
                    REPORTS
                  </TabsTrigger>

                </TabsList>
              </div>
              <TabsContent value="dryout" className="w-full min-w-0 overflow-x-hidden">
                <Card className="bg-gray-50 p-3 w-full min-w-0">
                  <VisuallyHidden>
                    <CardHeader>
                      <CardTitle>SOD</CardTitle>
                      <CardDescription>sod</CardDescription>
                    </CardHeader>
                  </VisuallyHidden>
                  <CardContent className="space-y-2 p-0">
                    {isInitialLoading ? (
                      <ApiLoader loading={true} />
                    ) : (
                    <>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        className="text-gray-700 h-14 px-4 py-4 min-w-[7rem]"
                        onClick={handleResetAllFilters}
                      >
                        All India
                      </Button>

                      {fixedDryoutCount.length > 0 &&
                        fixedDryoutCount.map((filter, index) => {
                          const styles = getFilterStyles(
                            filter.color,
                            activeFilter === index
                          );
                          return (
                            <div
                              key={filter.name}
                              onClick={() => {
                                handleDryoutSelection(filter.name, index);
                                toggleFilter(filter.name, index);
                              }}
                              className={`
                                rounded-lg px-4 py-1 transition-all duration-300 w-full min-[400px]:w-44 sm:w-48 shadow-md cursor-pointer border shrink-0
                                ${styles.container}
                              `}
                            >
                              <div className="flex flex-col">
                                <h3 className="text-gray-700 text-sm text-center font-medium">
                                  {filter.name}
                                </h3>
                                <div className="flex items-center justify-center gap-2">
                                  <span className={styles.text}>
                                    {filter.count}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">

<CustomMultiSelect
  key={`zone-${resetKey}`}
  options={zoneData.length > 0 ? zoneData : []}
  onValueChange={(value) =>
    handleFilterChange(value, "zoneName")
  }
  placeholder="Select zone"
  variant="secondary"
  animation={2}
  maxCount={0}
  className="w-full min-w-[8rem] sm:w-52 max-w-[13rem]"
/>

<CustomMultiSelect
  key={`plant-${resetKey}`}
  options={plantData}
  onValueChange={(value) =>
    handleFilterChange(value, "plantName")
  }
  placeholder="Select plant"
  variant="secondary"
  animation={2}
  maxCount={0}
  className="w-full min-w-[8rem] sm:w-52 max-w-[13rem]"
/>

<CustomMultiSelect
  key={`customer-${resetKey}`}
  options={customerData}
  onValueChange={(value) => {
    const isSelectAll = value.length === customerData?.length;
    handleFilterChange(isSelectAll ? [] : value, "customerName")
  }}
  placeholder="Select Dealer"
  variant="secondary"
  animation={2}
  maxCount={0}
  className="w-full min-w-[8rem] sm:w-44 max-w-[11rem]"
/>

<CustomMultiSelect
  key={`product-${resetKey}`}
  options={productData}
  onValueChange={(value) => handleFilterChange(value, "productName")}
  defaultValue={["2811000", "2812000", "2822000"]}
  placeholder="Product"
  variant="secondary"
  animation={2}
  maxCount={0}
  className="w-full min-w-[7rem] sm:w-40 max-w-[10rem]"
/>
                      <div className="items-center flex space-x-2">
                        <Checkbox
                          id="terms1"
                          checked={category}
                          onCheckedChange={handleCategoryChange}
                        />
                        <div className="grid gap-1.5 leading-none">
                          <label
                            htmlFor="terms1"
                            className="text-xs font-medium md:text-[0.6rem] lg:text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            CAT A
                          </label>
                        </div>
                      </div>

                      <div className="items-center flex space-x-2">
                        <Checkbox
                          id="dryoutro"
                          checked={dryoutRO}
                          onCheckedChange={(event) =>
                            handleDryoutROChange(event, "sod")
                          }
                        />
                        <div className="grid gap-1.5 leading-none">
                          <label
                            htmlFor="dryoutro"
                            className="text-sm font-medium md:text-[0.6rem] lg:text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            Dryout
                          </label>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetAllFilters}
                        className="flex items-center gap-2"
                      >
                        <X className="h-4 w-4" />
                        Reset Filters
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDryoutRefresh}
                        className="flex items-center gap-2"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Refresh
                      </Button>
                    </div>
                    <div className="flex flex-col lg:flex-row gap-3 w-full overflow-x-hidden">
                      <div className="flex-shrink-0 w-full lg:w-48 mt-2">
                        {/* DRY OUT COUNT */}
                        <div className="space-y-4 w-full lg:w-48">
                          {dryoutCount.length > 0 ? (
                            dryoutCount.map((filter, index) => {
                              const isVisible =
                                dryoutVisibleItem === filter.name ||
                                !dryoutVisibleItem;

                              if (!isVisible) return null;

                              const isSelected =
                                selectedDryout?.name === filter.name;

                              return (
                                <div
                                  key={filter.name}
                                  onClick={() =>
                                    handleDryoutSelection(filter.name, index)
                                  }
                                  className={`
                                    group relative rounded-xl border-2 px-3 py-3 transition-all duration-300 
                                    ${isSelected
                                      ? `border-${filter.color}-200 bg-${filter.color}-50 shadow-md transform scale-[1.02]`
                                      : `border-${filter.color}-100 hover:border-${filter.color}-200 hover:bg-${filter.color}-50 hover:shadow-md hover:scale-[1.01]`
                                    }
                                    cursor-pointer
                                  `}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                      <p
                                        className={`text-xs font-medium transition-colors duration-200
                                        ${isSelected
                                            ? `text-${filter.color}-700`
                                            : `text-${filter.color}-900 group-hover:text-${filter.color}-600`
                                          }`}
                                      >
                                        {filter.name}
                                      </p>
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`text-xl font-bold transition-colors duration-200
                                          ${isSelected
                                              ? `text-${filter.color}-700`
                                              : `text-${filter.color}-900 group-hover:text-${filter.color}-600`
                                            }`}
                                        >
                                          {filter.count}
                                        </span>
                                      </div>
                                    </div>
                                    <div
                                      className={`
                                      flex h-4 w-4 items-center justify-center rounded-md transition-all duration-300
                                      ${isSelected
                                          ? `bg-${filter.color}-500 text-white rotate-180`
                                          : `bg-${filter.color}-100 text-${filter.color}-400 group-hover:bg-${filter.color}-100 group-hover:text-${filter.color}-500`
                                        }
                                    `}
                                    />
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
                              No data available
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col w-full min-w-0">
                        {/* INITIAL STEPS CARDS - First API Call (actions: "initial_steps") */}
                        {isLoadingInitialSteps && <ApiLoader loading={isLoadingInitialSteps} />}
                        {initialStepsNumbers?.length > 0 ? ( 
                          <WorkflowDiagram dryoutCounts={initialStepsNumbers} type={'sod'} />
                        ) : (
                          !isLoadingInitialSteps && (
                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                              No data available
                            </div>
                          )
                        )}

                        {/* SOD (bu=sod): Carry Forward Indent + Pending Carry Forward Indent side by side */}
                        {(isLoadingCarryFwdIndent || isLoadingPendingCarryFwdIndent) && <ApiLoader loading={isLoadingCarryFwdIndent || isLoadingPendingCarryFwdIndent} />}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                          <div className="min-w-0">
                            {carryFwdIndentNumbers?.length > 0 ? (
                              <WorkflowDiagram dryoutCounts={carryFwdIndentNumbers} type="sod" />
                            ) : (
                              !isLoadingCarryFwdIndent && (
                                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                                  No data available
                                </div>
                              )
                            )}
                          </div>
                          <div className="min-w-0">
                            {pendingCarryFwdIndentNumbers?.length > 0 ? (
                              <WorkflowDiagram dryoutCounts={pendingCarryFwdIndentNumbers} type="sod" />
                            ) : (
                              !isLoadingPendingCarryFwdIndent && (
                                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                                  No data available
                                </div>
                              )
                            )}
                          </div>
                        </div>
                        {isLoadingDealerTruckCount && <ApiLoader loading={isLoadingDealerTruckCount} />}
                        {dealerTruckCountNumbers?.length > 0 ? (
                          <WorkflowDiagram dryoutCounts={dealerTruckCountNumbers} type="sod" />
                        ) : (
                          !isLoadingDealerTruckCount && (
                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                              No data available
                            </div>
                          )
                        )}
                      </div>
                    </div>
                    {/* CUSTOM LOLLIPOP CHART */}
                    <Card className="w-full bg-white shadow-md rounded-lg">
                      <VisuallyHidden>
                        <CardHeader></CardHeader>
                        <CardDescription></CardDescription>
                      </VisuallyHidden>
                      <CardContent className="p-2">
                        {chartData &&
                          chartData.length &&
                          topData?.length > 0 && (
                            <StatusTracker
                              data={statusTracker}
                              topLabels={topData}
                              bottomLabels={bottomData}
                            />
                          )}
                      </CardContent>
                    </Card>
                    <CTabs
                      variant="unstyled"
                      className="w-full"
                      index={activeTab}
                      onChange={handleAlertsTabChange}
                    >
                      <CTabList className="flex border-b">
                        {["Not Delivered", "Delivered"].map(
                          (tabName, index) => (
                            <CTab
                              key={tabName}
                              className={`relative px-4 py-2 text-sm font-medium transition-colors ${activeTab === index
                                  ? "text-blue-500"
                                  : "text-gray-600"
                                }`}
                            >
                              {tabName}
                              {activeTab === index && (
                                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400 rounded-full" />
                              )}
                            </CTab>
                          )
                        )}
                      </CTabList>

                      <CTabPanels className="p-4">
                        <CTabPanel>
                          {loadedTabs.has(0) && (
                            <ROAlertsTableV2 query={buildDynamicQuery(false)} fieldsFor="SOD" />
                          )}
                        </CTabPanel>
                        <CTabPanel>
                          {loadedTabs.has(1) && (
                            <ROAlertsTableV2 query={buildDynamicQuery(true)} fieldsFor="SOD" />
                          )}
                        </CTabPanel>
                      </CTabPanels>
                    </CTabs>
                    </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="reports">
                <SupplyChainReport />
              </TabsContent>
            </Tabs>
          </div>
        </DashboardProvider>
      </GlobalFilterProvider>

      {/* <BarChart /> */}
    </>
  );
}

export default SODSupplyChainComponent;