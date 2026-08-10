import React, { useState, useEffect } from 'react';
import { Tooltip, Button, IconButton, Box } from '@mui/material';
import CircleIcon from '@mui/icons-material/Circle';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
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
export function CustomChart1() {
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
    if (title === 'zoneName') { setZoneName(value); setStateName(''); setAreaName(''); getStatesData(value); getDistinctPlant(value); }
    if (title === 'stateName') { setStateName(value); setAreaName(''); getAreasData(value); getDistinctPlant(value); }
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
        {/* <FormControl sx={{ m: 0, paddingRight: 1, minWidth: 200, fontSize: '0.700rem' }} size="small">
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
        </FormControl> */}

        {/* <FormControl sx={{ m: 0, paddingRight: 1, minWidth: 200, fontSize: '0.700rem' }} size="small">
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
        </FormControl> */}

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