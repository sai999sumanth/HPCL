'use client';

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
import ROAlertsTableV2 from '../alertsTable/AlertTableV2';
import SupplyChainReport from '../supplychain-report';
import IndentStatusDashboard from './RoSupplyChainBignumberCards';
import CarryForwardAnalysis from '../SupplyChain/DaywiseDryoutChart';
import DryOutTrendsChart from '../SupplyChain/DryOutIntraDryOutTrendChart';
import FrequentlyDryOutTrendsChart from '../SupplyChain/FrequentlyDryOutTrendChart';
import DryoutLossVisualization from '../SupplyChain/DryoutLossBarChart';
import DynamicAgGrid from '../SupplyChain/RODryoutAgGrid';
import PermanentDryOutTrendsChart from '../SupplyChain/PermanentDryoutTrendChart';
import RetailTAR from './TARAnalysis';
import DryOutROLossChart from '../SupplyChain/DryOutROLossDrilldownChart';
import RODryoutAnalytics from './RODryoutAnalytics';
import { apiClient } from '@/services/apiClient';
import { RotateCcw, X } from 'lucide-react';

export function RetailSupplyChainComponent() {
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

  // Analytics tab specific filter states
  const [analyticsResetKey, setAnalyticsResetKey] = useState(0);
  const [analyticsFilters, setAnalyticsFilters] = useState({
    sodZoneName: [],
    sodPlantName: [],
    retailRegionName: [],
    retailAreaName: [],
    retailCustomerName: [],
    sodProductName: ["2811000", "2812000", "2822000"],
    categoryValue: null,
    dryoutRO: false
  });
  const [analyticsCategory, setAnalyticsCategory] = useState<boolean>(false);
  const [analyticsDryoutRO, setAnalyticsDryoutRO] = useState<boolean>(false);

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
    salesAreaData,
    customerData,
    dryoutCount,
    isLoadingData
  } = useOutletStore();
  // Retail Supply Chain only: actions initial_steps, tar_analysis, dry_out_analysis. Do NOT use carry_fwd_indent, pending_carry_fwd_indent, dealer_truck_count here.
  const { initialStepsNumbers, bigNumbers, tarAnalysisNumbers, fetchInitialStepsStats, fetchTarAnalysisStats, fetchOutletStats, isLoadingInitialSteps, isLoadingcardData, isLoadingTarData, setBuType } = useOutletStats();
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
    setComponentContext
  } = useSODStore();
  const location = useLocation();
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('retailOutlet') && path.includes('SupplyChain')) setBuType('ro');
    else if (path.includes('sodTerminal') && path.includes('sodSupplychain')) setBuType('sod');
  }, [location.pathname, setBuType]);
  const { selectedDryout, dryoutData, handleDryoutSelection, isLoading, error } = useDryout();

  // Minimum loader duration: 1s for big-number click (avoids flash of old values), 500ms min so user sees feedback
  const MIN_LOADING_MS = 1000;
  const [loadingStartTime, setLoadingStartTime] = useState(null);
  const [forceShowContent, setForceShowContent] = useState(false);
  const [keepLoaderVisible, setKeepLoaderVisible] = useState(false);
  const minLoadTimeoutRef = useRef(null);
  // Show loading immediately when filter dropdown changes (before 500ms debounce) - same as SOD
  const [isFilterLoading, setIsFilterLoading] = useState(false);
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const isAnyLoading = isLoadingData || isLoadingcardData || isLoadingTarData || isLoadingInitialSteps || isLoading;

    if (isAnyLoading && !loadingStartTime) {
      setLoadingStartTime(Date.now());
      setForceShowContent(false);
      setKeepLoaderVisible(false);
    } else if (!isAnyLoading) {
      const start = loadingStartTime;
      setLoadingStartTime(null);
      setForceShowContent(false);
      if (start != null) {
        const elapsed = Date.now() - start;
        const remainingMs = Math.max(0, MIN_LOADING_MS - elapsed);
        setKeepLoaderVisible(true);
        if (minLoadTimeoutRef.current) clearTimeout(minLoadTimeoutRef.current);
        minLoadTimeoutRef.current = setTimeout(() => {
          setKeepLoaderVisible(false);
          minLoadTimeoutRef.current = null;
        }, remainingMs);
      } else {
        setKeepLoaderVisible(false);
      }
    }
  }, [isLoadingData, isLoadingcardData, isLoadingTarData, isLoadingInitialSteps, isLoading, loadingStartTime]);

  useEffect(() => {
    return () => {
      if (minLoadTimeoutRef.current) clearTimeout(minLoadTimeoutRef.current);
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    };
  }, []);

  // isFilterLoading is cleared in fetchData/fetchDryStatusData .finally() to avoid double blink
  // (wait for ALL APIs incl. getDryoutCount and getDistinctLocationDetails before showing content)

  // Show full-screen loader: initial load, OR big-number click (incl. intradryout), OR filter dropdown change, OR minimum display time after load (same as SOD)
  const showFullScreenLoader =
    isInitialLoading ||
    isLoading ||
    isFilterLoading ||
    ((isLoadingData || isLoadingInitialSteps || isLoadingcardData || isLoadingTarData) && !forceShowContent) ||
    keepLoaderVisible;

  // After 15 seconds of loading, force show content to prevent infinite loading (incl. dropdown loading forever)
  useEffect(() => {
    const isWaiting = loadingStartTime || isFilterLoading;
    if (!isWaiting) return;

    const timeout = setTimeout(() => {
      console.warn('[v0] Loading timeout (15s) - forcing content display to prevent infinite loading');
      setForceShowContent(true);
      setIsFilterLoading(false);
    }, 15000);

    return () => clearTimeout(timeout);
  }, [loadingStartTime, isFilterLoading]);

  const SODHandleChange = useSODStore(state => state.SODHandleChange);
  const ProductName = useSODStore(state => state.sodProductName);

  // Guard: run initial load only once (avoids double load from Strict Mode or re-mount)
  const initialLoadRunRef = useRef(false);

  useEffect(() => {
    if (initialLoadRunRef.current) return;
    initialLoadRunRef.current = true;

    const initialProducts = ["2811000", "2812000", "2822000"];
    SODHandleChange(initialProducts, "productName");

    const MIN_LOADING_MS = 2000; // Keep loader visible at least 2s so UI shows once (no double-load flash)
    const initLoad = async () => {
      setInitialLoadStarted(true);
      const loadStart = Date.now();
      try {
        console.log('[v0] Starting initial data fetch (single batch)...');
        // Load all RO APIs in one go: dryout count + location details + handleDryoutSelection (which fires initial_steps, dryout_analysis, tar_analysis, outlet data, dryout count)
        await Promise.allSettled([
          getDryoutCount().catch(err => console.warn('[v0] getDryoutCount failed:', err)),
          getDistinctLocationDetails("RO").catch(err => console.warn('[v0] getDistinctLocationDetails failed:', err)),
          handleDryoutSelection("DRY OUT", 0, 'firstTime').catch(err => console.warn('[v0] handleDryoutSelection failed:', err))
        ]);
        console.log('[v0] Initial data fetch complete - all APIs loaded');
      } catch (error) {
        console.error('[v0] Initial load error:', error);
      } finally {
        const elapsed = Date.now() - loadStart;
        const wait = Math.max(0, MIN_LOADING_MS - elapsed);
        setTimeout(() => setIsInitialLoading(false), wait);
      }
    };

    initLoad();
  }, []);

  // Safety: force hide loading after 15s to prevent infinite loading
  useEffect(() => {
    if (!initialLoadStarted) return;
    const t = setTimeout(() => setIsInitialLoading(false), 15000);
    return () => clearTimeout(t);
  }, [initialLoadStarted]);
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

    if (retailRegionName?.length > 0) {
      query += ` AND region IN ('${retailRegionName.join("','")}')`;
    }
    if (retailAreaName?.length > 0) {
      query += ` AND sales_area IN ('${retailAreaName.join("','")}')`;
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
      // For RO type, we need to pass retail filter fields
      // For TAS/SOD type, we pass SOD filter fields
      const filterParams = filters || getAllStoredData();

      // Get current values from store or filter params
      // Note: Zone is stored as sodZoneName but needs to be passed as retailZoneName for RO type
      const zoneValue = filterParams?.sodZoneName || sodZoneName || [];
      const regionValue = filterParams?.retailRegionName || retailRegionName || [];
      const areaValue = filterParams?.retailAreaName || retailAreaName || [];
      const customerValue = filterParams?.retailCustomerName || retailCustomerName || [];
      const categoryEnabled = filterParams?.categoryValue?.length > 0 || categoryValue?.length > 0 || false;

      await fetchOutletFilters({
        type: type,
        filters: type === 'RO' ? {
          // Map sodZoneName to retailZoneName for RO type
          retailZoneName: zoneValue && zoneValue.length > 0 ? zoneValue : [],
          retailRegionName: regionValue && regionValue.length > 0 ? regionValue : [],
          retailAreaName: areaValue && areaValue.length > 0 ? areaValue : [],
          retailCustomerName: customerValue && customerValue.length > 0 ? customerValue : [],
          isCategoryEnabled: categoryEnabled
        } : {
          sodZoneName: filterParams?.sodZoneName || [],
          sodPlantName: filterParams?.sodPlantName || []
        }
      });
    } catch (error) {
      throw new Error('Failed to fetch Distinct location details');
    }
  }


  const reset = () => {
    const initialProducts = ["2811000", "2812000", "2822000"];
    const currentProducts = sodProductName.length > 0 ? sodProductName : initialProducts;

    setSelected('');
    setActiveFilter(null);

    setTimeout(async () => {
      try {
        const timeoutPromise = new Promise((resolve) => {
          setTimeout(() => {
            console.warn('[v0] Reset timeout - stopping wait after 10 seconds');
            resolve(null);
          }, 10000);
        });

        await Promise.race([
          Promise.allSettled([
            initialDryOutMount().catch(err => console.warn('[v0] initialDryOutMount failed:', err)),
            fetchInitialStepsStats({
              type: 'filterByAll',
              filters: {
                sodProductName: currentProducts
              }
            }).catch(err => console.warn('[v0] fetchInitialStepsStats failed:', err)),
            fetchTarAnalysisStats({
              type: 'filterByAll',
              filters: {
                sodProductName: currentProducts,
                dryout: { serial: null }
              }
            }).catch(err => console.warn('[v0] fetchTarAnalysisStats failed:', err)),
            fetchOutletStats({
              type: 'filterByAll',
              filters: {
                sodProductName: currentProducts,
                dryout: { serial: null }
              }
            }).catch(err => console.warn('[v0] fetchOutletStats failed:', err))
          ]),
          timeoutPromise
        ]);
      } catch (error) {
        console.error('[v0] Reset error:', error);
      }
    }, 500);

  }

  const numbers = Array.from({ length: roleLength }, (_, index) => index + 1);

  // Create fetchData - same pattern as SOD Supply Chain (handleFilterChange + fetchData)
  const fetchData = useCallback(async (type: string, updates = {}) => {
    if (isResetting) return;

    const filterParams = getAllStoredData();
    const mergedFilters = { ...filterParams, ...updates };

    const initialStepsApiCall = fetchInitialStepsStats({
      type: 'filterByIndent',
      filters: { ...mergedFilters, dryout: { serial: null } }
    }).catch(err => {
      console.error('❌ fetchInitialStepsStats failed:', err);
      return null;
    });
    const tarApiCall = fetchTarAnalysisStats({
      type: 'filterByIndent',
      filters: { ...mergedFilters, dryout: { serial: null } }
    }).catch(err => {
      console.error('❌ fetchTarAnalysisStats failed:', err);
      return null;
    });
    const outletStatsApiCall = fetchOutletStats({
      type: 'filterByIndent',
      filters: { ...mergedFilters, dryout: { serial: null } }
    }).catch(err => {
      console.error('❌ fetchOutletStats failed:', err);
      return null;
    });

    try {
      await Promise.all([
        fetchOutletData({ type: 'filterByIndent', filters: mergedFilters }),
        initialStepsApiCall,
        tarApiCall,
        outletStatsApiCall,
        fetchDryOutCount({ type: 'filterByIndent', filters: mergedFilters }),
        getDistinctLocationDetails(type, mergedFilters),
        getDryoutCount()
      ]);
    } finally {
      setIsFilterLoading(false);
    }
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
    // Show loading immediately (same as SOD) - before 500ms debounce
    setIsFilterLoading(true);
    // Ensure we pass the event directly, even if it's an empty array
    SODHandleChange(event, name);
    let allData = getAllStoredData();
    allData.selectedDryout = selectedDryout;
    // Debounce: clear previous timeout
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    filterDebounceRef.current = setTimeout(() => {
      filterDebounceRef.current = null;
      fetchData('RO', allData);
    }, 500);
  };

  const handleDryStatusFilterChange = (event: any, name: string) => {
    // Show loading immediately (same as SOD) - before 500ms debounce
    setIsFilterLoading(true);
    SODHandleChange(event, name);
    const allData = getAllStoredData();
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    filterDebounceRef.current = setTimeout(() => {
      filterDebounceRef.current = null;
      fetchDryStatusData(allData);
    }, 500);
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
    if (isResetting) return;

    const filterParams = {
      categoryValue: categoryValue,
      sodZoneName,
      sodPlantName,
      sodCustomerName,
      sodProductName,
      retailCustomerName,
      retailRegionName,
      retailAreaName,
      dryout_in_days: { serial: selectedDryout?.index + 1 },
      dryout: { serial: progressRate },
      ...updates
    };

    try {
      await Promise.all([
        fetchOutletData({ type: 'dryStatusChange', filters: filterParams }),
        fetchInitialStepsStats({
          type: 'dryStatusChange',
          filters: { ...filterParams, dryout: { serial: null } }
        }),
        fetchTarAnalysisStats({
          type: 'dryStatusChange',
          filters: { ...filterParams, dryout: { serial: null } }
        }),
        fetchOutletStats({
          type: 'dryStatusChange',
          filters: { ...filterParams, dryout: { serial: null } }
        }),
        fetchDryOutCount({ type: 'dryStatusChange', filters: filterParams }),
        getDistinctLocationDetails('RO', filterParams),
        getDryoutCount()
      ]);
    } finally {
      setIsFilterLoading(false);
    }
  }, [
    sodZoneName,
    sodPlantName,
    sodCustomerName,
    sodProductName,
    retailCustomerName,
    retailRegionName,
    retailAreaName,
    selectedDryout,
    progressRate,
    isResetting
  ]);


  const fetchRetailData = useCallback(async (updates = {}) => {
    // Don't fetch if we're in the middle of a reset
    if (isResetting) {
      return;
    }
    
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
    try {
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          console.warn('[v0] fetchRetailData timeout - stopping wait after 10 seconds');
          resolve(null);
        }, 10000);
      });

      await Promise.race([
        Promise.allSettled([
          fetchOutletData({
            type: 'filterByIndent',
            filters: filterParams,
          }).catch(err => console.warn('[v0] fetchOutletData (retail) failed:', err)),
          fetchInitialStepsStats({
            type: 'filterByIndent',
            filters: {
              ...filterParams,
              dryout: { serial: null }
            }
          }).catch(err => console.warn('[v0] fetchInitialStepsStats (retail) failed:', err)),
          fetchTarAnalysisStats({
            type: 'filterByIndent',
            filters: {
              ...filterParams,
              dryout: { serial: null }
            }
          }).catch(err => console.warn('[v0] fetchTarAnalysisStats (retail) failed:', err)),
          fetchOutletStats({
            type: 'filterByIndent',
            filters: {
              ...filterParams,
              dryout: { serial: null }
            }
          }).catch(err => console.warn('[v0] fetchOutletStats (retail) failed:', err))
        ]),
        timeoutPromise
      ]);
    } catch (error) {
      console.error('[v0] fetchRetailData error:', error);
    }
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
    progressRate,
    isResetting
  ]);

  const RetailHandleChange = async (event: any, name: string) => {
    let title = name;
    let value = event;

    SODHandleChange(event, name);

    const allData = getAllStoredData();
    // After change, you can get all current data
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
    getDistinctLocationDetails('RO').catch(err => console.warn('[v0] getDistinctLocationDetails failed:', err));
    resetStoredData();

    // Initialize with the dryStatusChange parameter type
    setTimeout(async () => {
      try {
        const timeoutPromise = new Promise((resolve) => {
          setTimeout(() => {
            console.warn('[v0] handleDryStatusTabChange timeout - stopping wait after 10 seconds');
            resolve(null);
          }, 10000);
        });

        await Promise.race([
          Promise.allSettled([
            fetchOutletData({
              type: 'dryStatusChange',
              filters: {}
            }).catch(err => console.warn('[v0] fetchOutletData failed:', err)),
            fetchInitialStepsStats({
              type: 'dryStatusChange',
              filters: {}
            }).catch(err => console.warn('[v0] fetchInitialStepsStats failed:', err)),
            fetchTarAnalysisStats({
              type: 'dryStatusChange',
              filters: {}
            }).catch(err => console.warn('[v0] fetchTarAnalysisStats failed:', err)),
            fetchOutletStats({
              type: 'dryStatusChange',
              filters: {}
            }).catch(err => console.warn('[v0] fetchOutletStats failed:', err)),
            fetchDryOutCount({
              type: 'dryStatusChange',
              filters: {}
            }).catch(err => console.warn('[v0] fetchDryOutCount failed:', err))
          ]),
          timeoutPromise
        ]);
      } catch (error) {
        console.error('[v0] handleDryStatusTabChange error:', error);
      }
    }, 500);
  }

  const handleTabChange = (type) => {
    if (type === 'retail') {
      setActiveTabValue("retail");
      getDistinctLocationDetails('RO').catch(err => console.warn('[v0] getDistinctLocationDetails failed:', err));
      resetStoredData();
    } else if (type === 'dryStatusChange') {
      setActiveTabValue("dryStatusChange");
      handleDryStatusTabChange();
    } else {
      setActiveTabValue("dryout");
      getDistinctLocationDetails('TAS').catch(err => console.warn('[v0] getDistinctLocationDetails failed:', err));
      resetStoredData();

      // Reset and initialize the DRYOUT tab
      setTimeout(async () => {
        try {
          const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
              console.warn('[v0] handleTabChange timeout - stopping wait after 10 seconds');
              resolve(null);
            }, 10000);
          });

          await Promise.race([
            Promise.allSettled([
              fetchOutletData({
                type: 'filterByIndent', // Use 'filterByIndent' for the DRYOUT tab
                filters: {}
              }).catch(err => console.warn('[v0] fetchOutletData failed:', err)),
              fetchInitialStepsStats({
                type: 'filterByIndent',
                filters: {}
              }).catch(err => console.warn('[v0] fetchInitialStepsStats failed:', err)),
              fetchTarAnalysisStats({
                type: 'filterByIndent',
                filters: {}
              }).catch(err => console.warn('[v0] fetchTarAnalysisStats failed:', err)),
              fetchOutletStats({
                type: 'filterByIndent',
                filters: {}
              }).catch(err => console.warn('[v0] fetchOutletStats failed:', err)),
              fetchDryOutCount({
                type: 'filterByIndent',
                filters: {}
              }).catch(err => console.warn('[v0] fetchDryOutCount failed:', err))
            ]),
            timeoutPromise
          ]);
        } catch (error) {
          console.error('[v0] handleTabChange error:', error);
        }
      }, 500);
    }
  }

  // Analytics tab filter handlers - same as Dryout tab
  const handleAnalyticsFilterChange = (event: any, name: string) => {
    // Update global store (same as Dryout tab)
    SODHandleChange(event, name);
    
    // Map filter names to analyticsFilters state keys
    const filterNameMap: Record<string, string> = {
      "zoneName": "sodZoneName",
      "regionName": "retailRegionName",
      "areaName": "retailAreaName",
      "customerName": "retailCustomerName",
      "productName": "sodProductName"
    };
    
    const stateKey = filterNameMap[name] || name;
    
    // Update local analytics filters state
    setAnalyticsFilters(prev => ({
      ...prev,
      [stateKey]: event
    }));
    
    // Get all stored data and update filter options dynamically
    let allData = getAllStoredData();
    
    // Debounce the fetch call (same as Dryout tab)
    const timeoutId = setTimeout(() => {
      // Update filter options based on current selections
      getDistinctLocationDetails('RO', allData);
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  const handleAnalyticsResetFilters = async () => {
    const initialProducts = ["2811000", "2812000", "2822000"];
    
    // Reset global store (same as Dryout tab)
    SODHandleChange([], "zoneName");
    SODHandleChange([], "regionName");
    SODHandleChange([], "areaName");
    SODHandleChange([], "customerName");
    SODHandleChange(initialProducts, "productName");
    SODHandleChange(null, "categoryValue");
    
    // Reset local analytics filters state
    setAnalyticsResetKey(prev => prev + 1);
    setAnalyticsFilters({
      sodZoneName: [],
      sodPlantName: [],
      retailRegionName: [],
      retailAreaName: [],
      retailCustomerName: [],
      sodProductName: initialProducts,
      categoryValue: null,
      dryoutRO: false
    });
    setAnalyticsCategory(false);
    setAnalyticsDryoutRO(false);
    
    // Reset stored data
    resetStoredData();
    
    // Update filter options
    setTimeout(async () => {
      await getDistinctLocationDetails('RO');
    }, 500);
  };

  const handleAnalyticsCategoryChange = async (event) => {
    setAnalyticsCategory(event);
    
    // Update global store (same as Dryout tab)
    if (event) {
      SODHandleChange(["R01"], 'categoryValue');
      setAnalyticsFilters(prev => ({
        ...prev,
        categoryValue: ["R01"]
      }));
    } else {
      SODHandleChange(null, 'categoryValue');
      setAnalyticsFilters(prev => ({
        ...prev,
        categoryValue: null
      }));
    }
    
    // Update filter options
    const allData = getAllStoredData();
    const timeoutId = setTimeout(() => {
      getDistinctLocationDetails('RO', allData);
    }, 500);
    
    return () => clearTimeout(timeoutId);
  };

  const handleAnalyticsDryoutROChange = async (event) => {
    setAnalyticsDryoutRO(event);
    setAnalyticsFilters(prev => ({
      ...prev,
      dryoutRO: event
    }));
  };

  const handleAnalyticsRefresh = async () => {
    // Get all current filter data to preserve selections
    const allData = getAllStoredData();

    // Ensure all filter values are included
    const refreshFilters = {
      ...allData,
      sodZoneName: allData.sodZoneName || sodZoneName || [],
      sodProductName: allData.sodProductName || sodProductName || ["2811000", "2812000", "2822000"],
      retailRegionName: allData.retailRegionName || retailRegionName || [],
      retailAreaName: allData.retailAreaName || retailAreaName || [],
      retailCustomerName: allData.retailCustomerName || retailCustomerName || [],
      categoryValue: allData.categoryValue || categoryValue || null,
    };

    try {
      // Update filter options based on current selections
      await getDistinctLocationDetails('RO', refreshFilters);
      
      // Update analytics filters state to trigger chart re-renders
      setAnalyticsFilters({
        sodZoneName: refreshFilters.sodZoneName || [],
        sodPlantName: refreshFilters.sodPlantName || [],
        retailRegionName: refreshFilters.retailRegionName || [],
        retailAreaName: refreshFilters.retailAreaName || [],
        retailCustomerName: refreshFilters.retailCustomerName || [],
        sodProductName: refreshFilters.sodProductName || ["2811000", "2812000", "2822000"],
        categoryValue: refreshFilters.categoryValue || null,
        dryoutRO: false
      });
    } catch (error) {
      console.error('Error refreshing Analytics tab data:', error);
    }
  };

  // Convert analytics filters to API filter format
  const convertAnalyticsFiltersToArray = () => {
    const filterArray: any[] = [];

    if (analyticsFilters.sodZoneName?.length > 0) {
      analyticsFilters.sodZoneName.forEach(zone => {
        filterArray.push({ key: "zone", cond: "equals", value: zone });
      });
    }

    if (analyticsFilters.retailRegionName?.length > 0) {
      analyticsFilters.retailRegionName.forEach(region => {
        filterArray.push({ key: "region", cond: "equals", value: region });
      });
    }

    if (analyticsFilters.retailAreaName?.length > 0) {
      analyticsFilters.retailAreaName.forEach(area => {
        filterArray.push({ key: "sales_area", cond: "equals", value: area });
      });
    }

    if (analyticsFilters.retailCustomerName?.length > 0) {
      analyticsFilters.retailCustomerName.forEach(customer => {
        filterArray.push({ key: "dealer_id", cond: "equals", value: customer });
      });
    }

    if (analyticsFilters.sodProductName?.length > 0) {
      analyticsFilters.sodProductName.forEach(product => {
        filterArray.push({ key: "product_code", cond: "equals", value: product });
      });
    }

    if (analyticsFilters.categoryValue?.length > 0) {
      filterArray.push({ key: "category", cond: "equals", value: "R01" });
    }

    return filterArray;
  };

  const handleDryoutRefresh = async () => {
    // Get all current filter data to preserve selections
    const allData = getAllStoredData();
    allData.selectedDryout = selectedDryout;

    // Ensure all filter values are included
    const refreshFilters = {
      ...allData,
      sodZoneName: allData.sodZoneName || sodZoneName || [],
      sodProductName: allData.sodProductName || sodProductName || ["2811000", "2812000", "2822000"],
      retailRegionName: allData.retailRegionName || retailRegionName || [],
      retailAreaName: allData.retailAreaName || retailAreaName || [],
      retailCustomerName: allData.retailCustomerName || retailCustomerName || [],
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
        fetchTarAnalysisStats({
          type: activeTabValue === 'dryStatusChange' ? 'dryStatusChange' : 'filterByIndent',
          filters: { ...refreshFilters, dryout: { serial: null } }
        }),
        fetchOutletStats({
          type: activeTabValue === 'dryStatusChange' ? 'dryStatusChange' : 'filterByIndent',
          filters: { ...refreshFilters, dryout: { serial: null } }
        }),
        fetchDryOutCount({
          type: activeTabValue === 'dryStatusChange' ? 'dryStatusChange' : 'filterByIndent',
          filters: refreshFilters
        }),
        getDistinctLocationDetails('RO', refreshFilters),
        getDryoutCount()
      ]);
    } catch (error) {
      console.error('Error refreshing DryOut tab data:', error);
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
        fetchTarAnalysisStats({
          type: 'filterByAll',
          filters: { ...filters, dryout: { serial: null } }
        }),
        fetchOutletStats({
          type: 'filterByAll',
          filters: { ...filters, dryout: { serial: null } }
        }),
        fetchDryOutCount({
          type: 'filterByAll',
          filters: filters
        }),
        getDistinctLocationDetails('RO'),
        getDryoutCount()
      ]);
      
      // Clear resetting flag after API calls complete
      setIsResetting(false);
    }, 500);
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
          // retailZoneName,
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
          fetchTarAnalysisStats({
            type: apiType,
            filters: { ...categoryFilters, dryout: { serial: null } }
          }),
          fetchOutletStats({
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
        // retailZoneName,
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
        fetchTarAnalysisStats({
          type: apiType,
          filters: { ...noCategoryFilters, dryout: { serial: null } }
        }),
        fetchOutletStats({
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


  // Sync Analytics filters with global store when Analytics tab is active
  useEffect(() => {
    if (activeTabValue === "analytics") {
      setAnalyticsFilters({
        sodZoneName: sodZoneName || [],
        sodPlantName: sodPlantName || [],
        retailRegionName: retailRegionName || [],
        retailAreaName: retailAreaName || [],
        retailCustomerName: retailCustomerName || [],
        sodProductName: sodProductName || ["2811000", "2812000", "2822000"],
        categoryValue: categoryValue || null,
        dryoutRO: false
      });
      setAnalyticsCategory(categoryValue?.length > 0 || false);
    }
  }, [activeTabValue, sodZoneName, sodPlantName, retailRegionName, retailAreaName, retailCustomerName, sodProductName, categoryValue]);
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
          <div className="space-y-1">
            <Tabs defaultValue="dryout" className="" onValueChange={(value) => {
              if (value === "analytics") {
                setActiveTabValue("analytics");
              } else if (value === "dryout") {
                handleTabChange("retail");
              }
            }}>
              <div className="flex justify-between">
                <TabsList className="grid w-120 grid-cols-5">
                  <TabsTrigger
                    value="dryout"
                    onClick={() => handleTabChange("retail")}
                  >
                    DRYOUT
                  </TabsTrigger>
                  <TabsTrigger value="analytics">ANALYTICS</TabsTrigger>
                  <TabsTrigger value="reports">REPORTS</TabsTrigger>
                  <TabsTrigger value="tar">TAR ANALYSIS</TabsTrigger>
                  <TabsTrigger value="dryout sales">SALES ANALYSIS</TabsTrigger>

                </TabsList>
              </div>
              <TabsContent value="dryout" className="w-full">
                <Card className="bg-gray-50 p-3">
                  <VisuallyHidden>
                    <CardHeader>
                      <CardTitle>SOD</CardTitle>
                      <CardDescription>sod</CardDescription>
                    </CardHeader>
                  </VisuallyHidden>

                  <CardContent className="space-y-2 p-0">
                    {showFullScreenLoader ? (
                      <ApiLoader loading={true} />
                    ) : (
                    <>
                    <div className="flex items-start justify-between mb-2 gap-2">
                      {/* Left side - All India + Filter cards */}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          className="text-gray-700 h-14 px-4 py-4 bg-transparent"
                          onClick={reset}
                        >
                          All India
                        </Button>

                        {fixedDryoutCount.length > 0 &&
                          fixedDryoutCount.map((filter, index) => {
                            const styles = getFilterStyles(filter.color, activeFilter === index);
                            return (
                              <div
                                key={filter.name}
                                onClick={() => {
                                  handleDryoutSelection(filter.name, index);
                                  toggleFilter(filter.name, index);
                                }}
                                className={`
              rounded-lg px-4 py-1 transition-all duration-300 w-48 shadow-md cursor-pointer border
              ${styles.container}
            `}
                              >
                                <div className="flex flex-col">
                                  <h3 className="text-gray-700 text-sm text-center font-medium">
                                    {filter.name}
                                  </h3>
                                  <div className="flex items-center justify-center gap-2">
                                    <span className={styles.text}>{filter.count}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>

                      {/* Right side - Reset & Refresh buttons */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleResetAllFilters}
                          className="flex items-center gap-2 bg-transparent"
                        >
                          <X className="h-4 w-4" />
                          Reset Filters
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDryoutRefresh}
                          className="flex items-center gap-2 bg-transparent"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Refresh
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">

                      <CustomMultiSelect
                        key={`zone-${resetKey}`}
                        options={zoneData.length > 0 ? zoneData : []}
                        onValueChange={(value) => handleFilterChange(value, "zoneName")}
                        value={sodZoneName || []}
                        placeholder="Select zone"
                        variant="secondary"
                        animation={2}
                        maxCount={0}
                        className="w-full min-w-[8rem] sm:w-52 max-w-[13rem]"
                      />

                      <CustomMultiSelect
                        key={`region-${resetKey}`}
                        options={regionData && regionData.length > 0 ? regionData : []}
                        onValueChange={(value) => handleFilterChange(value, "regionName")}
                        value={retailRegionName || []}
                        placeholder="Select region"
                        variant="secondary"
                        animation={2}
                        maxCount={0}
                        className="w-full min-w-[8rem] sm:w-52 max-w-[13rem]"
                      />

                      <CustomMultiSelect
                        key={`area-${resetKey}`}
                        options={salesAreaData && salesAreaData.length > 0 ? salesAreaData : []}
                        onValueChange={(value) => handleFilterChange(value, "areaName")}
                        value={retailAreaName || []}
                        placeholder="Select sales area"
                        variant="secondary"
                        animation={2}
                        maxCount={0}
                        className="w-full min-w-[8rem] sm:w-48 max-w-[13rem]"
                      />

                      <CustomMultiSelect
                        key={`customer-${resetKey}`}
                        options={customerData?.length > 0 ? customerData : []}
                        onValueChange={(value) => {
                          const isSelectAll = value.length === customerData?.length;
                          handleFilterChange(isSelectAll ? [] : value, "customerName");
                        }}
                        value={retailCustomerName || []}
                        placeholder="Select customer"
                        variant="secondary"
                        animation={2}
                        maxCount={0}
                        className="w-full min-w-[8rem] sm:w-44 max-w-[11rem]"
                      />

                      <CustomMultiSelect
                        key={`product-${resetKey}`}
                        options={productData}
                        onValueChange={(value) => handleFilterChange(value, "productName")}
                        value={sodProductName || ["2811000", "2812000", "2822000"]}
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

                      {/* <div className="items-center flex space-x-2">
                        <Checkbox
                          id="dryoutro"
                          checked={dryoutRO}
                          onCheckedChange={(event) =>
                            handleDryoutROChange(event, "retail")
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
                      </div> */}
                    </div>
                    <div className="flex gap-3">
                      <div className="row-span-3 mt-2">
                        {/* DRY OUT COUNT */}
                        <div className="space-y-4 w-48">
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
                            <>
                              <div className="relative border-2 px-3 py-2 rounded-lg border-red-100 hover:border-red-200 hover:shadow-md">
                                <div className="flex items-center justify-between">
                                  <div className="space-y-1">
                                    <p className="transition-colors group-hover:text-red-600">
                                      <Skeleton className="w-[56px] max-w-full" />
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <span className="transition-colors group-hover:text-red-600">
                                        <Skeleton className="w-[40px] max-w-full" />
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex h-4 w-4 items-center justify-center group-hover:bg-red-100 group-hover:text-red-500" />
                                </div>
                              </div>
                              <div className="relative border-2 px-3 py-2 rounded-lg border-orange-100 hover:border-orange-200 hover:shadow-md">
                                <div className="flex items-center justify-between">
                                  <div className="space-y-1">
                                    <p className="transition-colors group-hover:text-orange-600">
                                      <Skeleton className="w-[136px] max-w-full" />
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <span className="transition-colors group-hover:text-orange-600">
                                        <Skeleton className="w-[40px] max-w-full" />
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex h-4 w-4 items-center justify-center group-hover:bg-orange-100 group-hover:text-orange-500" />
                                </div>
                              </div>
                              <div className="relative border-2 px-3 py-2 rounded-lg border-blue-100 hover:border-blue-200 hover:shadow-md">
                                <div className="flex items-center justify-between">
                                  <div className="space-y-1">
                                    <p className="transition-colors group-hover:text-blue-600">
                                      <Skeleton className="w-[136px] max-w-full" />
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <span className="transition-colors group-hover:text-blue-600">
                                        <Skeleton className="w-[48px] max-w-full" />
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex h-4 w-4 items-center justify-center group-hover:bg-blue-100 group-hover:text-blue-500" />
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 w-full">
                        {/* INITIAL STEPS (actions: initial_steps) */}
                        {isLoadingInitialSteps && !initialStepsNumbers?.length && !forceShowContent && <ApiLoader loading={isLoadingInitialSteps} />}
                        {initialStepsNumbers?.length > 0 ? (
                          <WorkflowDiagram dryoutCounts={initialStepsNumbers} type={'retail'} />
                        ) : (
                          (!isLoadingInitialSteps || forceShowContent) && (
                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                              No data available
                            </div>
                          )
                        )}
                        {/* RO: Indent = second row of dryout_analysis (items 6+) when bigNumbers has >5 */}
                        {(() => {
                          const indentFromDryout = (bigNumbers?.length > 5 ? bigNumbers.slice(5).map((s, i) => ({ ...s, group: 'indent', serial: (s.serial ?? i + 6) })) : null);
                          const indentData = indentFromDryout ?? null;
                          if (indentData?.length > 0) return <WorkflowDiagram dryoutCounts={indentData} type={'retail'} />;
                          if (!isLoadingcardData || forceShowContent) {
                            return (
                              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                                No data available
                              </div>
                            );
                          }
                          return null;
                        })()}
                        {/* RO: Dryout Analysis = first row only (first 5 items from bigNumbers) */}
                        {isLoadingcardData && !bigNumbers?.length && !forceShowContent && <ApiLoader loading={isLoadingcardData} />}
                        {bigNumbers?.length > 0 ? (
                          <WorkflowDiagram dryoutCounts={bigNumbers.slice(0, 5)} type={'retail'} />
                        ) : (
                          (!isLoadingcardData || forceShowContent) && (
                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                              No data available
                            </div>
                          )
                        )}
                        {/* RO: TAR Analysis */}
                        {isLoadingTarData && !tarAnalysisNumbers?.length && !forceShowContent && <ApiLoader loading={isLoadingTarData} />}
                        {tarAnalysisNumbers?.length > 0 ? (
                          <WorkflowDiagram dryoutCounts={tarAnalysisNumbers} type={'retail'} />
                        ) : (
                          (!isLoadingTarData || forceShowContent) && (
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
                            <ROAlertsTableV2 query={buildDynamicQuery(false)} fieldsFor="RO" />
                          )}
                        </CTabPanel>
                        <CTabPanel>
                          {loadedTabs.has(1) && (
                            <ROAlertsTableV2 query={buildDynamicQuery(true)} fieldsFor="RO" />
                          )}
                        </CTabPanel>
                      </CTabPanels>
                    </CTabs>
                    </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="analytics">
                <Card className="bg-gray-50 p-3 mb-2">
                  <VisuallyHidden>
                    <CardHeader>
                      <CardTitle>Analytics Filters</CardTitle>
                      <CardDescription>Filter analytics data</CardDescription>
                    </CardHeader>
                  </VisuallyHidden>

                  <CardContent className="space-y-2 p-0">
                    <div className="flex items-start justify-between mb-2 gap-2">
                    <div className="flex gap-2">
                      <CustomMultiSelect
                        key={`zone-analytics-${analyticsResetKey}`}
                        options={zoneData.length > 0 ? zoneData : []}
                        onValueChange={(value) =>
                          handleAnalyticsFilterChange(value, "zoneName")
                        }
                        value={sodZoneName || []}
                        placeholder="Select zone"
                        variant="secondary"
                        animation={2}
                        maxCount={0}
                        className="w-30"
                      />

                      <CustomMultiSelect
                        key={`region-analytics-${analyticsResetKey}`}
                        options={regionData && regionData.length > 0 ? regionData : []}
                        onValueChange={(value) =>
                          handleAnalyticsFilterChange(value, "regionName")
                        }
                        value={retailRegionName || []}
                        placeholder="Select region"
                        variant="secondary"
                        animation={0}
                        maxCount={0}
                        className="w-30"
                      />

                      <CustomMultiSelect
                        key={`area-analytics-${analyticsResetKey}`}
                        options={salesAreaData && salesAreaData.length > 0 ? salesAreaData : []}
                        onValueChange={(value) =>
                          handleAnalyticsFilterChange(value, "areaName")
                        }
                        value={retailAreaName || []}
                        placeholder="Select sales area"
                        variant="secondary"
                        animation={0}
                        maxCount={0}
                        className="w-48"
                      />

                      <CustomMultiSelect
                        key={`customer-analytics-${analyticsResetKey}`}
                        options={customerData?.length > 0 ? customerData : []}
                        onValueChange={(value) => {
                          const isSelectAll = value.length === customerData?.length;
                          handleAnalyticsFilterChange(isSelectAll ? [] : value, "customerName");
                        }}
                        value={retailCustomerName || []}
                        placeholder="Select customer"
                        variant="secondary"
                        animation={0}
                        maxCount={0}
                        className="w-48"
                      />
                      <CustomMultiSelect
                        key={`product-analytics-${analyticsResetKey}`}
                        options={productData}
                        onValueChange={(value) => handleAnalyticsFilterChange(value, "productName")}
                        value={sodProductName || ["2811000", "2812000", "2822000"]}
                        placeholder="Product"
                        variant="secondary"
                        animation={2}
                        maxCount={0}
                        className="w-40"
                      />
                      <div className="items-center flex space-x-2">
                        <Checkbox
                          id="terms-analytics"
                          checked={categoryValue?.length > 0 || false}
                          onCheckedChange={handleAnalyticsCategoryChange}
                        />
                        <div className="grid gap-1.5 leading-none">
                          <label
                            htmlFor="terms-analytics"
                            className="text-xs font-medium md:text-[0.6rem] lg:text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            CAT A
                          </label>
                        </div>
                      </div>
{/* 
                      <div className="items-center flex space-x-2">
                        <Checkbox
                          id="dryoutro-analytics"
                          checked={analyticsDryoutRO}
                          onCheckedChange={handleAnalyticsDryoutROChange}
                        />
                        <div className="grid gap-1.5 leading-none">
                          <label
                            htmlFor="dryoutro-analytics"
                            className="text-sm font-medium md:text-[0.6rem] lg:text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            Dryout
                          </label>
                        </div>
                      </div> */}
                    </div>
                                      <div className="flex justify-end mb-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAnalyticsResetFilters}
                      className="flex items-center gap-2 bg-transparent"
                    >
                      <X className="h-4 w-4" />
                      Reset Filters
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAnalyticsRefresh}
                      className="flex items-center gap-2 bg-transparent"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Refresh
                    </Button>
                  </div>
                  </div>
                  </CardContent>
                </Card>
                <IndentStatusDashboard filters={analyticsFilters} />
                <CarryForwardAnalysis filters={analyticsFilters} />
                <DryOutTrendsChart filters={convertAnalyticsFiltersToArray()} />
                <FrequentlyDryOutTrendsChart filters={convertAnalyticsFiltersToArray()} />
                <PermanentDryOutTrendsChart filters={convertAnalyticsFiltersToArray()} />
              </TabsContent>
              <TabsContent value="reports">
                <SupplyChainReport />
              </TabsContent>
              <TabsContent value="tar">
                <RetailTAR />
              </TabsContent>
              <TabsContent value="dryout sales">
                <DryoutLossVisualization />

                <DryOutROLossChart />
                <DynamicAgGrid />

                <RODryoutAnalytics />
              </TabsContent>
            </Tabs>
          </div>
        </DashboardProvider>
      </GlobalFilterProvider>

      {/* <BarChart /> */}
    </>
  );
}

export default RetailSupplyChainComponent;
