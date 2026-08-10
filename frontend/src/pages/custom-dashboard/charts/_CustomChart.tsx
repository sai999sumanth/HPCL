import React, { useState, useEffect } from 'react';
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
import { ArrowUpRight, ChevronLeft, ChevronRight, ClipboardCheck, FileText, Filter, Navigation, Receipt, ShoppingCart, TrendingDown, TrendingUp, Truck } from 'lucide-react';
import { VisuallyHidden } from '@chakra-ui/react';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
// import Select from '@mui/material/Select';
import axios from 'axios';
import { Tooltip, IconButton, Box } from '@mui/material';
import { keyframes } from '@mui/system';
import CircleIcon from '@mui/icons-material/Circle';
import ModalDialogBox from './ModalDialogBox';
import { Badge } from '@/@/components/ui/badge';
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/@/components/ui/select";
import { Checkbox } from '@/@/components/ui/checkbox';
import ROAlertsTable from '@/pages/component/alertsTable/ROAlertsTable';
import { CustomMultiSelect } from '@/@/components/ui/custom-multiselect';
import { Skeleton, SVGSkeleton } from './Skeleton';
import { data } from './data';
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
      {isOpen && <ModalDialogBox props={props} isOpen={isOpen} alert_id={props.alert_id} sendDataToParent={closeModal} />}
    </>
  );
}


export function MetricCard(props: any) {
  const { title, value, isSelected, onSelect } = props;
  const getTrendColor = (trend) => {
    if (value === 0) return 'text-gray-400';
    return value > 30 ? 'text-green-600' : 'text-orange-600';
  };

  return (
    <Card 
      className={`
        bg-white hover:shadow-lg transition-all duration-300 border-2 shadow-md cursor-pointer
        ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-transparent'}
      `}
      onClick={onSelect}
    >
      <CardContent className="px-3 py-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <h3 className="text-xs font-medium text-gray-600">{title}</h3>
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-xl font-bold text-gray-900">{value}</span>
          </div>
          {parseFloat(value) > 0 && (
            <div className={`flex items-center ${getTrendColor(value)}`}>
              {parseFloat(value) > 30 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};


export function CustomChart () {
  const [chartData, setChartData] = useState<any>(null);
  const [topData, setTopData] = useState<any>(null);
  const [bottomData, setBottomData] = useState<any>(null);
  const [roleLength, setRoleLength] = useState<any>(0);
  const [zoneData, setZoneData] = useState<any>([]);
  const [stateData, setStateData] = useState<any>([]);
  const [areaData, setAreaData] = useState<any>([]);
  const [plantData, setPlantData] = useState<any>([]);
  const [regionData, setRegionData] = useState<any>([]);
  
  //! NOTE: FOR SOD GLOBAL SEARCH
  let [sodZoneName, setSodZoneName] = useState<any>([]);
  let [sodPlantName, setSodPlantName] = useState<any>([]);

  //! NOTE: RETAIL GLOBAL SEARCH
  let [retailZoneName, setRetailZoneName] = useState<any>([]);
  let [retailPlantName, setRetailPlantName] = useState<any>([]);
  let [retailRegionName, setRetailRegionName] = useState<any>([]);
  let [retailAreaName, setAreaName] = useState<any>([]);

  const [bigNumbers, setBigNumbers] = useState<any>([]);
  const [dryoutCount, setDryoutCount] = useState<any>([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [selected, setSelected] = useState('');

  const handleSelection = (filterName) => {
    setSelected(filterName);
  };

  useEffect(() => {
    fetchOutletData('sod');
    getDistinctLocationDetails('sod');
    getDryoutCount()
  }, [])

  const getLimitTxt = (text: any, maxLength: number) => {
    let shortenedText =
      text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
    return shortenedText;
  };

  const fetchFilterData = async (column: string, whereCond: object) => {
    const params: any = {
      connection_id: "",
      schema: "public",
      table: "location_master",
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

  const getDistinctLocationDetails = async (type) => {
    let params = {};
    if(type === 'sod') {
      params = {
        bu: "TAS",
        zone: sodZoneName,
        plant: sodPlantName
      }
    } else if(type === 'retail') {
      params = {
        bu: "RO",
        zone: retailZoneName,
        region: retailRegionName,
        sales_area: retailAreaName,
        plant: retailPlantName
      }
    }
    
    try {
      const response = await apiClient.post('/api/indentdryout/get_distinct_location_details', params);
      console.log("response", response);
      const { data } = response.data;
      if (response && response.data.status === true) {
        setZoneData(data?.['zone']);
        if(type === 'retail') {
          setPlantData(data?.['customer']);
          setRegionData(data?.['region']);
          setAreaData(data?.['sales_area']);
        } else {
          setPlantData(data?.['plant']);
        }
        
      }
    } catch (error) {
      throw new Error('Failed to fetch Distinct location details');
    }
  }

  const getDistinctPlant = async (region: any) => {
    let params = {
      region: region
    }
    try {
      const response = await apiClient.post('/api/indentdryout/get_distinct_plant', params);
      setPlantData(response.data);
    } catch (error) {
      throw new Error('Failed to fetch users');
    }
  }

  const fetchOutletData = async (type) => {
    let params: any = {}
    if(type === 'sod') {
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: sodZoneName },
          { key: 'plant', cond: '=', value: sodPlantName },
        ]
      }
    } else if(type === 'retail') {
      params = {
        filters: [
          { key: 'interlock_name', cond: '=', value: ['Dry Out Each Indent Wise MainFlow'] },
          { key: 'zone', cond: '=', value: retailZoneName },
          { key: 'plant', cond: '=', value: retailPlantName },
          { key: 'region', cond: '=', value: retailRegionName },
          { key: 'sales_area', cond: '=', value: retailAreaName },
        ]
      }
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

  const reset = () => {
    setSodZoneName('');
    setAreaName('');
    setSodPlantName('');
    setTimeout(() => {
      fetchOutletData('retail');
    },  500)
    
  }

  const numbers = Array.from({ length: roleLength }, (_, index) => index + 1);

  const RetailTabChange=()=>{
    getDistinctLocationDetails('retail');
    fetchOutletData('retail');
    getDryoutCount();
  }

  const SODHandleChange = (event: any, name: string) => {
    let title = name; 
    let value = event;
    if (title === 'zoneName') { sodZoneName = value; }
    if (title === 'plantName') { sodPlantName = value; }
    setTimeout(() => {
      getDistinctLocationDetails('sod');
      fetchOutletData('sod');
    }, 500)
  }

  const RetailHandleChange = (event: any, name: string) => {
    console.log("event for handle change", event);
    let title = name; // event.target.name;
    let value = event;
    if (title === 'zoneName') { retailZoneName = value; }
    if (title === 'regionName') { retailRegionName = value; }
    if (title === 'areaName') { retailAreaName = value; }
    if (title === 'plantName') { retailPlantName = value; }

    setTimeout(() => {
      getDistinctLocationDetails('retail');
      fetchOutletData('retail');
    }, 500)
  }

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
      console.log("response", response);
      setDryoutCount(transformData(response.data))
    } catch(error) {
      console.log(error)
    }
  }

  const handleSelect = (serial) => {
    setSelectedCard(selectedCard === serial ? null : serial);
  };

  return (
    <>
      <Tabs defaultValue="sod" className="">
        <div className="flex justify-between">
          <TabsList className="grid w-96 grid-cols-3">
            <TabsTrigger value="sod">SOD</TabsTrigger>
            <TabsTrigger onClick={RetailTabChange} value="retail">Retail</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button variant="outline" className="text-red-500">
              0-1
            </Button>
            <Button variant="outline" className="text-red-600">
              1-7
            </Button>
            <Button variant="outline" className="text-red-700">
              7-15
            </Button>
            <Button variant="outline">
              <ChevronLeft className="h-5 w-5" color="red" />{" "}
            </Button>
            <Button variant="outline">
              <ChevronRight className="h-5 w-5" color="blue" />{" "}
            </Button>
            <Button variant="outline">Pending Invoices</Button>
          </div>
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
              <div className="flex gap-3">
                <div className="row-span-3 space-y-2">
                  {/* DRY OUT COUNT */}
                  <div className="space-y-2 w-56">
                    {dryoutCount.length > 0 ? dryoutCount.map((filter) => (
                      <div
                        key={filter.name}
                        onClick={() => handleSelection(filter.name)}
                        className={`
                          group relative bg-white rounded-xl border-2 px-3 py-2 transition-all duration-300 
                          ${selected === filter.name 
                            ? `border-${filter.color}-200 bg-${filter.color}-50/50 shadow-md transform scale-[1.02]`
                            : `border-${filter.color}-100 hover:border-${filter.color}-200 hover:bg-${filter.color}-50 hover:shadow-md hover:scale-[1.01]`
                          }
                          cursor-pointer
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className={`text-xs font-medium transition-colors duration-200
                              ${selected === filter.name ? `text-${filter.color}-700` : `text-${filter.color}-900 group-hover:text-${filter.color}-600`}`}>
                              {filter.name}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className={`text-xl font-bold transition-colors duration-200 text-${filter.color}-600
                                ${selected === filter.name ? `text-${filter.color}-700` : `text-${filter.color}-900 group-hover:text-${filter.color}-600`}`}>
                                {filter.count}
                              </span>
                            </div>
                          </div>
                          <div className={`
                            flex h-4 w-4 items-center justify-center rounded-md transition-all duration-300
                            ${selected === filter.name
                              ? `bg-${filter.color}-500 text-white rotate-180`
                              : `bg-${filter.color}-100 text-${filter.color}-400 group-hover:bg-${filter.color}-100 group-hover:text-${filter.color}-500`
                            }
                          `}>
                          </div>
                        </div>
                        {/* <div className={`
                          absolute inset-x-0 bottom-0 h-1 rounded-b-xl transition-all duration-300
                          ${selected === filter.name ? 'bg-blue-500' : 'bg-transparent group-hover:bg-blue-200'}
                        `} /> */}
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
                <div className="flex flex-col gap-3 w-full">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="text-gray-700 h-10 px-5"
                      onClick={reset}
                    >
                      All India
                    </Button>

                    <CustomMultiSelect
                      options={zoneData}
                      onValueChange={(value) => SODHandleChange(value, 'zoneName')}
                      defaultValue={sodZoneName}
                      placeholder="Select zone"
                      variant="secondary"
                      animation={2}
                      maxCount={1}
                      className="w-80"
                    />

                    <CustomMultiSelect
                      options={plantData}
                      onValueChange={(value) => SODHandleChange(value, 'plantName')}
                      defaultValue={sodPlantName}
                      placeholder="Select plant"
                      variant="secondary"
                      animation={2}
                      maxCount={1}
                      className={'w-96'}
                    />

                    {/* <Select value={zoneName} onValueChange={(value) => handleChange(value, 'zoneName')}>
                      <SelectTrigger className="w-[250px] border-none shadow-sm">
                        <SelectValue placeholder="Select a zone" />
                      </SelectTrigger>
                      <SelectContent className="border-none">
                        <SelectGroup>
                          <SelectLabel>Zone</SelectLabel>
                          {
                            zoneData.length > 0 &&
                            zoneData.map((name: any) => (
                              <SelectItem value={name}>{name}</SelectItem>
                            ))
                          }
                        </SelectGroup>
                      </SelectContent>
                    </Select> */}

                    {/* <Select value={plantName} onValueChange={(value) => handleChange(value, 'plantName')}>
                      <SelectTrigger className="w-[250px] border-none shadow-sm">
                        <SelectValue placeholder="Select a plant" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Zone</SelectLabel>
                          {
                            plantData.length > 0 &&
                            plantData.map((name: any) => (
                              <SelectItem value={name}>{name}</SelectItem>
                            ))
                          }
                        </SelectGroup>
                      </SelectContent>
                    </Select> */}

                    <div className="items-center flex space-x-2">
                      <Checkbox id="terms1" />
                      <div className="grid gap-1.5 leading-none">
                        <label
                          htmlFor="terms1"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          CAT A
                        </label>
                      </div>
                    </div>
                  </div>
                  {/* ALL INDENT DRY OUT COUNT */}
                  <div className="grid sm:grid-cols-3 md:grid-cols-6 gap-3">
                    {
                      bigNumbers.length > 0 ? bigNumbers.map((metric, index) => (
                        <MetricCard
                          key={index}
                          title={metric.section}
                          value={metric.value}
                          isSelected={selectedCard === metric.serial}
                          onSelect={() => handleSelect(metric.serial)}                   
                        />
                      )) : (
                        Array.from({length: 11}).map((_, index) => (
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
                      )
                    }
                  </div>
                </div>
              </div>
              
              {/* CUSTOM LOLLIPOP CHART */}
              <Card className="w-full bg-white shadow-md rounded-lg">
                <VisuallyHidden>
                  <CardHeader></CardHeader><CardDescription></CardDescription>
                </VisuallyHidden>
                <CardContent className="p-2">
                  <div
                    style={{
                      fontFamily: "Arial, sans-serif",
                      margin: "10px",
                      fontSize: "0.700rem",
                      overflowY: "auto",
                      maxHeight: "448px",
                    }}
                  >
                    {chartData && topData && bottomData && (
                      <table
                        style={{
                          width: "100%",
                          margin: "0 auto",
                          borderCollapse: "collapse",
                          backgroundColor: "#fff",
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              textAlign: "center",
                              backgroundColor: "#f7f7f7",
                              color: "#000",
                              position: "sticky",
                              top: 0,
                              zIndex: "49"
                            }}
                          >
                            <td style={{ width: "1%" }}>
                              Days
                              <br />
                              (dryout)
                            </td>
                            <td style={{ width: "15%", borderRight: '1px solid #eee' }}>Retail Outlet</td>
                            {numbers &&
                              numbers.map((num, index) => (
                                <td style={{ borderRight: '1px solid #eee' }}>
                                  <Tooltip title={topData[index]} placement="top">
                                    <span>{topData[index]}</span>
                                  </Tooltip>
                                </td>
                              ))}
                          </tr>
                        </thead>
                        <tbody>
                          {chartData.map((item: any, index: number) => (
                            <tr
                              key={index}
                              style={{ textAlign: "center", height: "1rem" }}
                            >
                              <td>{item.dry_out_days}</td>
                              <td style={{ textAlign: "left" }}>
                                <Tooltip title={topData[index]} placement="top">
                                  <span>{getLimitTxt(item.name, 25)}</span>
                                </Tooltip>
                              </td>
                              <td colSpan={item.present_stage}>
                                <BarWithDotIcon
                                  alert_id={item.alert_id}
                                  top={topData[item.present_stage - 1]}
                                  bottom={bottomData[item.present_stage - 1]}
                                />
                              </td>
                              {roleLength > item.present_stage && (
                                <td colSpan={roleLength - item.present_stage}></td>
                              )}
                            </tr>
                          ))}
                          <tr
                            style={{
                              textAlign: "center",
                              backgroundColor: "#f7f7f7",
                              color: "#000",
                              position: "sticky",
                              bottom: 0,
                            }}
                          >
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            {numbers &&
                              numbers.map((num, index) => (
                                <td>
                                  <Tooltip
                                    title={bottomData[index]}
                                    placement="top"
                                  >
                                    <span>{bottomData[index]}</span>
                                  </Tooltip>
                                </td>
                              ))}
                          </tr>
                        </tbody>
                      </table>
                    )}
                  </div>
                </CardContent>
              </Card>
              <ROAlertsTable query="bu='RO' AND interlock_name!='Indent Dryout'" />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="retail">
          <Card className="bg-gray-50 p-3">
            <VisuallyHidden>
              <CardHeader>
                <CardTitle>Retail</CardTitle>
                <CardDescription> Retail Overall dashboard </CardDescription>
              </CardHeader>
            </VisuallyHidden>
            <CardContent className="space-y-2 p-2">
              <div className="flex gap-3">
                <div className="row-span-3 space-y-2">
                  {/* DRY OUT COUNT */}
                  <div className="space-y-2 w-56">
                    {dryoutCount.map((filter) => (
                      <div
                        key={filter.name}
                        onClick={() => handleSelection(filter.name)}
                        className={`
                          group relative rounded-xl border-2 px-3 py-2 transition-all duration-300 
                          ${selected === filter.name 
                            ? `border-${filter.color}-200 bg-${filter.color}-50/50 shadow-md transform scale-[1.02]`
                            : `border-${filter.color}-100 hover:border-${filter.color}-200 hover:bg-${filter.color}-50 hover:shadow-md hover:scale-[1.01]`
                          }
                          cursor-pointer
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className={`text-xs font-medium transition-colors duration-200
                              ${selected === filter.name ? `text-${filter.color}-700` : `text-${filter.color}-900 group-hover:text-${filter.color}-600`}`}>
                              {filter.name}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className={`text-xl font-bold transition-colors duration-200 text-${filter.color}-600
                                ${selected === filter.name ? `text-${filter.color}-700` : `text-${filter.color}-900 group-hover:text-${filter.color}-600`}`}>
                                {filter.count}
                              </span>
                            </div>
                          </div>
                          <div className={`
                            flex h-4 w-4 items-center justify-center rounded-md transition-all duration-300
                            ${selected === filter.name
                              ? `bg-${filter.color}-500 text-white rotate-180`
                              : `bg-${filter.color}-100 text-${filter.color}-400 group-hover:bg-${filter.color}-100 group-hover:text-${filter.color}-500`
                            }
                          `}>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-3 w-full overflow-x-auto">
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
                      onValueChange={(value) => RetailHandleChange(value, 'zoneName')}
                      defaultValue={retailZoneName}
                      placeholder="Select zone"
                      variant="secondary"
                      animation={0}
                      maxCount={1}
                      className="w-64"
                    />

                    <CustomMultiSelect
                      options={regionData}
                      onValueChange={(value) => RetailHandleChange(value, 'regionName')}
                      defaultValue={retailRegionName}
                      placeholder="Select region"
                      variant="secondary"
                      animation={0}
                      maxCount={1}
                      className="w-64"
                    />

                    <CustomMultiSelect
                      options={areaData}
                      onValueChange={(value) => RetailHandleChange(value, 'areaName')}
                      defaultValue={retailAreaName}
                      placeholder="Select sales area"
                      variant="secondary"
                      animation={0}
                      maxCount={1}
                      className="w-64"
                    />

                    <CustomMultiSelect
                      options={plantData}
                      onValueChange={(value) => RetailHandleChange(value, 'plantName')}
                      defaultValue={retailPlantName}
                      placeholder="Select customer"
                      variant="secondary"
                      animation={0}
                      maxCount={2}
                      className="w-60"
                    />

                    <div className="items-center flex space-x-2">
                      <Checkbox id="terms1" />
                      <div className="grid gap-1.5 leading-none">
                        <label
                          htmlFor="terms1"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          CAT A
                        </label>
                      </div>
                    </div>

                  </div>
                  <div className="grid sm:grid-cols-3 md:grid-cols-6 gap-3">
                    { 
                      bigNumbers.length > 0 && bigNumbers.map((metric, index) => (
                        <MetricCard
                          key={index}
                          title={metric.section}
                          value={metric.value}                      
                        />
                      ))
                    }
                  </div>
                </div>
              </div>

              <Card className="w-full bg-white shadow-md rounded-lg">
                <VisuallyHidden>
                  <CardHeader></CardHeader><CardDescription></CardDescription>
                </VisuallyHidden>
                <CardContent className="p-2">
                  <div
                    style={{
                      fontFamily: "Arial, sans-serif",
                      margin: "10px",
                      fontSize: "0.700rem",
                      overflowY: "auto",
                      maxHeight: "448px",
                    }}
                  >
                    {chartData && topData && bottomData && (
                      <table
                        style={{
                          width: "100%",
                          margin: "0 auto",
                          borderCollapse: "collapse",
                          backgroundColor: "#fff",
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              textAlign: "center",
                              backgroundColor: "#f7f7f7",
                              color: "#000",
                              position: "sticky",
                              top: 0,
                              zIndex: "49"
                            }}
                          >
                            <td style={{ width: "1%" }}>
                              Days
                              <br />
                              (dryout)
                            </td>
                            <td style={{ width: "15%", borderRight: '1px solid #eee' }}>Retail Outlet</td>
                            {numbers &&
                              numbers.map((num, index) => (
                                <td style={{ borderRight: '1px solid #eee' }}>
                                  <Tooltip title={topData[index]} placement="top">
                                    <span>{topData[index]}</span>
                                  </Tooltip>
                                </td>
                              ))}
                          </tr>
                        </thead>
                        <tbody>
                          {chartData.map((item: any, index: number) => (
                            <tr
                              key={index}
                              style={{ textAlign: "center", height: "1rem" }}
                            >
                              <td>{item.dry_out_days}</td>
                              <td style={{ textAlign: "left" }}>
                                <Tooltip title={topData[index]} placement="top">
                                  <span>{getLimitTxt(item.name, 25)}</span>
                                </Tooltip>
                              </td>
                              <td colSpan={item.present_stage}>
                                <BarWithDotIcon
                                  alert_id={item.alert_id}
                                  top={topData[item.present_stage - 1]}
                                  bottom={bottomData[item.present_stage - 1]}
                                />
                              </td>
                              {roleLength > item.present_stage && (
                                <td colSpan={roleLength - item.present_stage}></td>
                              )}
                            </tr>
                          ))}
                          <tr
                            style={{
                              textAlign: "center",
                              backgroundColor: "#f7f7f7",
                              color: "#000",
                              position: "sticky",
                              bottom: 0,
                            }}
                          >
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            {numbers &&
                              numbers.map((num, index) => ( 
                                <td>
                                  <Tooltip
                                    title={bottomData[index]}
                                    placement="top"
                                  >
                                    <span>{bottomData[index]}</span>
                                  </Tooltip>
                                </td>
                              ))}
                          </tr>
                        </tbody>
                      </table>
                    )}
                  </div>
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