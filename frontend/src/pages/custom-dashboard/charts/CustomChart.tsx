import React, { useState, useEffect, useCallback } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/@/components/ui/card";
import { Button } from '@/@/components/ui/button';
import { VisuallyHidden } from '@chakra-ui/react';
// import Select from '@mui/material/Select';
import axios from 'axios';
import { keyframes } from '@mui/system';
import { Checkbox } from '@/@/components/ui/checkbox';
import ROAlertsTable from '@/pages/component/alertsTable/ROAlertsTable';
import { CustomMultiSelect } from '@/@/components/ui/custom-multiselect';
import { Skeleton, SVGSkeleton } from './Skeleton';
import WorkflowDiagram from '../dryout-workfow/WorkflowDiagram';
import { useOutletStore } from '@/store/useOutletStore';
import { useDryout } from '@/providers/DryoutProvider';
import { useOutletStats } from '@/store/usOutletStats';
import { useSODStore } from '@/store/useFilterStore';
import StatusTracker from '../status-tracker/StatusTracker';
import { transformChartData } from '../status-tracker/utils';
import ApiLoader from '@/services/apiLoader';
import { apiClient } from '@/services/apiClient';

const expandBar = keyframes`
  0% {
    width: 0%;
  }
  100% {
    width: 50%;
  }
`;

export function CustomChart () {
  const [stateData, setStateData] = useState<any>([]);
  const [areaData, setAreaData] = useState<any>([]);
  // const [regionData, setRegionData] = useState<any>([]);
  const [category, setCategory] = useState<boolean>(false);
  const [dryoutRO, setDryoutRO] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState(0);
  const [fixedDryoutCount, setFixedDryoutCount] = useState<any>([]);
  const [selected, setSelected] = useState('DRY OUT');
  const [dryoutVisibleItem, setDryoutVisibleItem] = useState<any>('DRY OUT');

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
    isLoadingData
  } = useOutletStore();
  const { bigNumbers, fetchOutletStats } = useOutletStats();
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
    SODHandleChange, 
    progressRate, 
    getAllStoredData, 
    resetStoredData 
  } = useSODStore();

  const { selectedDryout, dryoutData, handleDryoutSelection, isLoading, error } = useDryout();


  useEffect(() => {
    handleDryoutSelection('DRY OUT', 0);
    getDistinctLocationDetails('TAS');
    getDryoutCount();
    fetchDryOutCount({
      type: 'filterByIndent',
      filters: {}
    });
  }, []);

  const initialDryOutMount = async () => {
    try {
      await fetchOutletData({
        type: 'filterByAll',
        filters: {
          dryout: { serial: 1}
        }
      });
    } catch (error) {
      console.error('Error fetching outlet data:', error);
    }
  }

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

  const reset = () => {
    // SODHandleChange([], )
    // setAreaName([]);
    // setSodPlantName([]);
    // setSodProductName([]);
    // setSodCustomerName([]);
    setSelected('');
    setActiveFilter(null);
    setTimeout( async() => {
      initialDryOutMount();
      await fetchOutletStats({
          type: 'filterByAll',
          filters: {}
        }
      );
    }, 500)
    
  }

  const numbers = Array.from({ length: roleLength }, (_, index) => index + 1);

  // Create fetchData as a memoized function
  const fetchData = useCallback(async (type, updates = {}) => {
    const filterParams = {
      categoryValue: categoryValue,
      sodZoneName,
      sodPlantName,
      sodCustomerName,
      sodProductName,
      retailZoneName,
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
      }),
      fetchOutletStats({
        type: 'filterByIndent',
        filters: {
          categoryValue: categoryValue,
          sodZoneName,
          sodPlantName,
          sodCustomerName,
          sodProductName,
          retailZoneName,
          retailCustomerName,
          retailRegionName,
          retailAreaName,
          dryout_in_days: { serial: selectedDryout?.index + 1 },
          dryout: { serial: null },
          ...updates  // Apply any immediate updates
        }
      }),
      fetchDryOutCount({
        type: 'filterByIndent',
        filters: filterParams
      }),
      getDistinctLocationDetails(type, filterParams)
    ]);
  }, [
    sodZoneName, 
    sodPlantName, 
    sodCustomerName, 
    sodProductName,
    retailZoneName,
    retailCustomerName,
    retailRegionName,
    retailAreaName,
    selectedDryout,
    progressRate
  ]);


  const handleFilterChange = (event: any, name: string) => {
    SODHandleChange(event, name);
    const allData = getAllStoredData();
    // After change, you can get all current data

    // Debounce the fetch call
    const timeoutId = setTimeout(() => {
      fetchData('TAS', allData);
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  // const fetchSalesAreaAndCustomer = async (selectedRegion) => {
  //   const salesAreas = await fetchFilterData('sales_area', [
  //     { key: 'region', cond: '=', value: selectedRegion },
  //   ]);
  //   setAreaData(salesAreas);
  
  //   const customers = await fetchFilterData('name', [
  //     { key: 'region', cond: '=', value: selectedRegion },
  //   ]);
  //   setPlantData(customers);
  // };


  const fetchRetailData = useCallback(async (updates = {}) => {
    // await getDistinctLocationDetails('retail');
    const filterParams = {
      categoryValue: categoryValue,
      sodZoneName,
      sodPlantName,
      sodCustomerName,
      sodProductName,
      retailZoneName,
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
      }),
      fetchOutletStats({
        type: 'filterByIndent',
        filters: filterParams,
      })
    ]);
  }, [
    sodZoneName, 
    sodPlantName, 
    sodCustomerName, 
    sodProductName,
    retailZoneName,
    retailCustomerName,
    retailRegionName,
    retailAreaName,
    selectedDryout,
    progressRate
  ]);

  const RetailHandleChange = async (event: any, name: string) => {
    let title = name;
    let value = event;
  
    // if (title === 'zoneName') {
    //   const regions = await fetchFilterData('region', [{ key: 'zone', cond: '=', value: value }]);
    //   setRegionData(regions);
    // }
    // if (title === 'regionName') {
    //   const salesAreas = await fetchFilterData('sales_area', [
    //     { key: 'region', cond: '=', value: value },
    //   ]);
    //   setAreaData(salesAreas);
    //   const customers = await fetchFilterData('name', [
    //     { key: 'region', cond: '=', value: value },
    //   ]);
    //   plantData = customers;
    //   // setPlantData(customers);
    // }

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
      if(response.data?.status === true) {
        setFixedDryoutCount(transformData(response.data?.data));
      }
      
    } catch(error) {
      console.log(error)
    }
  }

  const handleTabChange = (type) => {
    if(type === 'retail') {
      getDistinctLocationDetails('RO');
      resetStoredData();
    } else {
      getDistinctLocationDetails('TAS');
      resetStoredData();
    }
  }

  const handleCategoryChange = async (event) => {
    setCategory(event)
    if(event) {
      SODHandleChange(["R01"], 'categoryValue');
      // fetchOutletData('cat a');
      setTimeout(async () => {
        await fetchOutletStats({
          type: 'filterByIndent',
          filters: {
            categoryValue: ["R01"],
            sodZoneName: sodZoneName,
            sodPlantName: sodPlantName,
            sodCustomerName: sodCustomerName,
            sodProductName: sodProductName,
            retailZoneName: retailZoneName,
            retailCustomerName: retailCustomerName,
            retailRegionName: retailRegionName,
            retailAreaName: retailAreaName,
            dryout_in_days: { serial: selectedDryout?.index +1 },
            dryout: { serial: progressRate }
          }
        });
        await fetchOutletData({
          type: 'filterByIndent',
          filters: {
            categoryValue: ["R01"],
            sodZoneName: sodZoneName,
            sodPlantName: sodPlantName,
            sodCustomerName: sodCustomerName,
            sodProductName: sodProductName,
            retailZoneName: retailZoneName,
            retailCustomerName: retailCustomerName,
            retailRegionName: retailRegionName,
            retailAreaName: retailAreaName,
            dryout_in_days: { serial: selectedDryout?.index +1 },
            dryout: { serial: progressRate }
          }
        });
        await fetchDryOutCount({
          type: 'filterByIndent',
          filters: {
            categoryValue: ["R01"],
            sodZoneName: sodZoneName,
            sodPlantName: sodPlantName,
            sodCustomerName: sodCustomerName,
            sodProductName: sodProductName,
            retailZoneName: retailZoneName,
            retailCustomerName: retailCustomerName,
            retailRegionName: retailRegionName,
            retailAreaName: retailAreaName,
            dryout_in_days: { serial: selectedDryout?.index +1 },
            dryout: { serial: null }
          }
        })
      }, 200);
      
    } else {
      SODHandleChange(null, 'categoryValue');
      await fetchOutletStats({
        type: 'filterByIndent',
        filters: {
          categoryValue: null,
          sodZoneName: sodZoneName,
          sodPlantName: sodPlantName,
          sodCustomerName: sodCustomerName,
          sodProductName: sodProductName,
          retailZoneName: retailZoneName,
          retailCustomerName: retailCustomerName,
          retailRegionName: retailRegionName,
          retailAreaName: retailAreaName,
          dryout_in_days: { serial: selectedDryout?.index +1 },
          dryout: { serial: progressRate }
        }
      });
      await fetchOutletData({
        type: 'filterByIndent',
        filters: {
          categoryValue: null,
          sodZoneName: sodZoneName,
          sodPlantName: sodPlantName,
          sodCustomerName: sodCustomerName,
          sodProductName: sodProductName,
          retailZoneName: retailZoneName,
          retailCustomerName: retailCustomerName,
          retailRegionName: retailRegionName,
          retailAreaName: retailAreaName,
          dryout_in_days: { serial: selectedDryout?.index +1 },
          dryout: { serial: progressRate }
        }
      });
      await fetchDryOutCount({
        type: 'filterByIndent',
        filters: {
          categoryValue: null,
          sodZoneName: sodZoneName,
          sodPlantName: sodPlantName,
          sodCustomerName: sodCustomerName,
          sodProductName: sodProductName,
          retailZoneName: retailZoneName,
          retailCustomerName: retailCustomerName,
          retailRegionName: retailRegionName,
          retailAreaName: retailAreaName,
          dryout_in_days: { serial: selectedDryout?.index +1 },
          dryout: { serial: null }
        }
      })
    }
  }

  const handleDryoutROChange = async (event, type) => {
    setDryoutRO(event);
    if(event) {
      let params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'dry_out_in_days', cond: '=', value: ["1"] },
        ]
      }
      try {
        const res = await apiClient.post('/api/indentdryout/get_distinct_ro_name', params);
        const { data } = res.data;
        if(res.data?.status === true) {
          customerData = data?.['customer'];
          plantData = data?.['plant'];
        }
      } catch(error) {
        console.log(error)
      }
    } else {
      if (type === 'sod') {
        getDistinctLocationDetails('sod');
      } else if(type === 'retail') {
        getDistinctLocationDetails('retail');
      }
      
    }
  }

  const toggleFilter = (name, index) => {
    setActiveFilter(activeFilter === index ? null : index);
    getDryoutCount();
    setDryoutVisibleItem(activeFilter === index ? null : name);
  }

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
      <Tabs defaultValue="sod" className="">
        <div className="flex justify-between">
          <TabsList className="grid w-96 grid-cols-3">
            <TabsTrigger value="sod" onClick={() => handleTabChange('sod')}>SOD</TabsTrigger>
            <TabsTrigger value="retail" onClick={() => handleTabChange('retail')}>Retail</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="sod" className="w-full">
          <Card className="bg-gray-50 p-3">
            <VisuallyHidden>
              <CardHeader>
                <CardTitle>SOD</CardTitle>
                <CardDescription>sod</CardDescription>
              </CardHeader>
            </VisuallyHidden>
            <CardContent className="space-y-2 p-0">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="text-gray-700 h-14 px-4 py-4"
                  onClick={reset}
                >
                  All India
                </Button>

                {fixedDryoutCount.length > 0 && fixedDryoutCount.map((filter, index) => {
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
                            <span className={styles.text}>
                              {filter.count}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }
                )}
              </div>
              <div className="flex gap-2">
                {/* <Button
                  variant="outline"
                  className="text-gray-700 h-10 px-4 py-2"
                  onClick={reset}
                >
                  All India
                </Button> */}
                <CustomMultiSelect
                  options={zoneData.length > 0 ? zoneData : []}
                  onValueChange={(value) => handleFilterChange(value, "zoneName")}
                  defaultValue={sodZoneName}
                  placeholder="Select zone"
                  variant="secondary"
                  animation={2}
                  maxCount={0}
                  className="w-52"
                />

                <CustomMultiSelect
                  options={plantData}
                  onValueChange={(value) => handleFilterChange(value, "plantName")}
                  defaultValue={sodPlantName}
                  placeholder="Select plant"
                  variant="secondary"
                  animation={2}
                  maxCount={0}
                  className={"w-52"}
                />

                <CustomMultiSelect
                  options={customerData}
                  onValueChange={(value) => handleFilterChange(value, "customerName")}
                  defaultValue={sodCustomerName}
                  placeholder="Select Dealer"
                  variant="secondary"
                  animation={2}
                  maxCount={0}
                  className="w-44"
                />

                <CustomMultiSelect
                  options={productData}
                  onValueChange={(value) => handleFilterChange(value, "productName")}
                  defaultValue={sodProductName}
                  placeholder="Product"
                  variant="secondary"
                  animation={2}
                  maxCount={0}
                  className="w-40"
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
                      className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      CAT A
                    </label>
                  </div>
                </div>


                <div className="items-center flex space-x-2">
                  <Checkbox
                    id="dryoutro"
                    checked={dryoutRO}
                    onCheckedChange={(event) => handleDryoutROChange(event, 'sod') }
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="dryoutro"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Dryout
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="row-span-3 mt-2">
                  {/* DRY OUT COUNT */}
                  <div className="space-y-4 w-48">
                    {dryoutCount.length > 0 ? (
                      dryoutCount.map((filter, index) => {
                        const isVisible = dryoutVisibleItem === filter.name || !dryoutVisibleItem;
                        
                        if (!isVisible) return null;

                        const isSelected = selectedDryout?.name === filter.name;
                        
                        return (
                          <div
                            key={filter.name}
                            onClick={() => handleDryoutSelection(filter.name, index)}
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
                                <p className={`text-xs font-medium transition-colors duration-200
                                  ${isSelected ? `text-${filter.color}-700` : `text-${filter.color}-900 group-hover:text-${filter.color}-600`}`}>
                                  {filter.name}
                                </p>
                                <div className="flex items-center gap-2">
                                  <span className={`text-xl font-bold transition-colors duration-200
                                    ${isSelected ? `text-${filter.color}-700` : `text-${filter.color}-900 group-hover:text-${filter.color}-600`}`}>
                                    {filter.count}
                                  </span>
                                </div>
                              </div>
                              <div className={`
                                flex h-4 w-4 items-center justify-center rounded-md transition-all duration-300
                                ${isSelected
                                  ? `bg-${filter.color}-500 text-white rotate-180`
                                  : `bg-${filter.color}-100 text-${filter.color}-400 group-hover:bg-${filter.color}-100 group-hover:text-${filter.color}-500`
                                }
                              `} />
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
                  {/* ALL INDENT DRY OUT COUNT */}
                  {
                    isLoadingData && (
                      <ApiLoader loading={isLoadingData} />
                    ) 
                  }
                  {
                    bigNumbers?.length > 0 ? (
                      <WorkflowDiagram dryoutCounts={bigNumbers} />
                    ) : (
                      <div className="grid grid-cols-6 gap-3">
                        {
                          Array.from({length: 18}).map((_, index) => (
                            <div className="hover:shadow-lg border-0 shadow-md rounded-lg" key={index}>
                              <div className="p-6 px-3 py-2">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center space-x-3">
                                    <h3>
                                      <Skeleton className="w-[136px] max-w-full" />
                                    </h3>
                                  </div>
                                </div>
                                <div className="flex items-baseline justify-between">
                                  <div>
                                    <span>
                                      <Skeleton className="w-[32px] max-w-full" />
                                    </span>
                                  </div>
                                  <div className="flex items-center">
                                    <SVGSkeleton className="w-[24px] h-[24px]" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        } 
                      </div>
                    )
                  }
                </div>
              </div>
              {/* CUSTOM LOLLIPOP CHART */}
              <Card className="w-full bg-white shadow-md rounded-lg">
                <VisuallyHidden>
                  <CardHeader></CardHeader><CardDescription></CardDescription>
                </VisuallyHidden>
                <CardContent className="p-2">
                  {
                    chartData && chartData.length && topData?.length > 0 && (
                      <StatusTracker 
                        data={statusTracker}
                        topLabels={topData}
                        bottomLabels={bottomData}
                      />
                    )
                  }
                </CardContent>
              </Card>
              <ROAlertsTable query="bu='RO' AND interlock_name='Dry Out Each Indent Wise MainFlow'" />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="retail">
          <Card className="bg-gray-50 p-0">
            <VisuallyHidden>
              <CardHeader>
                <CardTitle>Retail</CardTitle>
                <CardDescription> Retail Overall dashboard </CardDescription>
              </CardHeader>
            </VisuallyHidden>
            <CardContent className="space-y-2 p-2">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="text-red-500 h-10 px-5"
                  onClick={reset}
                >
                  All India
                </Button>

                <CustomMultiSelect
                  options={zoneData}
                  onValueChange={(value) => RetailHandleChange(value, 'retailZoneName')}
                  defaultValue={retailZoneName}
                  placeholder="Select zone"
                  variant="secondary"
                  animation={0}
                  maxCount={0}
                  className="w-64"
                />

                <CustomMultiSelect
                  options={regionData}
                  onValueChange={(value) => RetailHandleChange(value, 'retailRegionName')}
                  defaultValue={retailRegionName}
                  placeholder="Select region"
                  variant="secondary"
                  animation={0}
                  maxCount={0}
                  className="w-64"
                />

                <CustomMultiSelect
                  options={areaData}
                  onValueChange={(value) => RetailHandleChange(value, 'retailAreaName')}
                  defaultValue={retailAreaName}
                  placeholder="Select sales area"
                  variant="secondary"
                  animation={0}
                  maxCount={0}
                  className="w-64"
                />

                <CustomMultiSelect
                  options={customerData}
                  onValueChange={(value) => RetailHandleChange(value, 'retailCustomerName')}
                  defaultValue={retailCustomerName}
                  placeholder="Select customer"
                  variant="secondary"
                  animation={0}
                  maxCount={0}
                  className="w-60"
                />

                <div className="items-center flex space-x-2">
                  <Checkbox
                    id="terms3"
                    checked={category}
                    onCheckedChange={handleCategoryChange}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="terms3"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      CAT A
                    </label>
                  </div>
                </div>

                <div className="items-center flex space-x-2">
                  <Checkbox
                    id="dryoutretail"
                    checked={dryoutRO}
                    onCheckedChange={(event) => handleDryoutROChange(event, 'retail')}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="dryoutretail"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Dryout RO
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="space-y-2 mt-2">
                  {/* DRY OUT COUNT */}
                  <div className="space-y-4 w-56">
                    {dryoutCount.length > 0 ? dryoutCount.map((filter, index) => (
                      <div
                        key={filter.name}
                        onClick={() => handleDryoutSelection(filter.name, index)}
                        className={`
                          group relative rounded-xl border-2 px-3 py-3 transition-all duration-300 
                          ${selectedDryout?.name === filter.name 
                            ? `border-${filter.color}-200 bg-${filter.color}-50 shadow-md transform scale-[1.02]`
                            : `border-${filter.color}-100 hover:border-${filter.color}-200 hover:bg-${filter.color}-50 hover:shadow-md hover:scale-[1.01]`
                          }
                          cursor-pointer
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className={`text-xs font-medium transition-colors duration-200
                              ${selectedDryout?.name === filter.name ? `text-${filter.color}-700` : `text-${filter.color}-900 group-hover:text-${filter.color}-600`}`}>
                              {filter.name}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className={`text-xl font-bold transition-colors duration-200 text-${filter.color}-600
                                ${selectedDryout?.name === filter.name ? `text-${filter.color}-700` : `text-${filter.color}-900 group-hover:text-${filter.color}-600`}`}>
                                {filter.count}
                              </span>
                            </div>
                          </div>
                          <div className={`
                            flex h-4 w-4 items-center justify-center rounded-md transition-all duration-300
                            ${selectedDryout?.name === filter.name
                              ? `bg-${filter.color}-500 text-white rotate-180`
                              : `bg-${filter.color}-100 text-${filter.color}-400 group-hover:bg-${filter.color}-100 group-hover:text-${filter.color}-500`
                            }
                          `}>
                          </div>
                        </div>
                      </div>
                    )) : (
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
                            <div className="flex h-4 w-4 items-center justify-center group-hover:bg-red-100 group-hover:text-red-500"></div>
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
                            <div className="flex h-4 w-4 items-center justify-center group-hover:bg-orange-100 group-hover:text-orange-500"></div>
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
                            <div className="flex h-4 w-4 items-center justify-center group-hover:bg-blue-100 group-hover:text-blue-500"></div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-3 w-full overflow-x-auto">
                  <div className="grid gap-3">
                    { 
                      bigNumbers?.length > 0 && (
                        <WorkflowDiagram dryoutCounts={bigNumbers} />
                      )
                    }
                  </div>
                </div>
              </div>

              <Card className="w-full bg-white shadow-md rounded-lg">
                <VisuallyHidden>
                  <CardHeader></CardHeader><CardDescription></CardDescription>
                </VisuallyHidden>
                <CardContent className="p-2">
                  {
                    chartData && chartData.length && topData?.length > 0 && (
                      <StatusTracker 
                        data={statusTracker}
                        topLabels={topData}
                        bottomLabels={bottomData}
                      />
                    )
                  }
              </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="analytics">
          <Card>
            <VisuallyHidden>
              <CardHeader>
                <CardTitle>Password</CardTitle>
                <CardDescription>
                  Change your password here. After saving, you'll be logged out.
                </CardDescription>
              </CardHeader>
            </VisuallyHidden>
            <CardContent className="space-y-2 h-screen p-2">
              <iframe
                src="/analytics-dnc/#/report-viewer?dir=Indent_DryOut_N&file=I_dashboard.efwdd&mode=open&j_username=hiadmin&j_password=hiadmin"
                className="w-full h-full"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                loading="lazy"
                allowFullScreen
              ></iframe>
            </CardContent>
          </Card>
        
        </TabsContent>
      </Tabs>
    </>
  );

}