

import React, { useState } from 'react';
import { Box, Card, CardContent, Typography, Grid } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { PieChart, Pie, Cell } from 'recharts';
import RouteIcon from '@mui/icons-material/Route';
import PowerIcon from '@mui/icons-material/Power';
import PanToolIcon from '@mui/icons-material/PanTool';
import SpeedIcon from '@mui/icons-material/Speed';
import NightlightIcon from '@mui/icons-material/Nightlight';
import DoNotDisturbOnIcon from '@mui/icons-material/DoNotDisturbOn';
import SignalCellularOffIcon from '@mui/icons-material/SignalCellularOff';
import BuildIcon from '@mui/icons-material/Build';
import Solidgaugechart from './Solidgaugechart';

const ViolationsTrend = () => {
  const [activePeriod, setActivePeriod] = useState('Today');

  // Period selector buttons configuration
  const periodButtons = [
    { key: 'Today', color: '#FF6B6B' },
    { key: '3M', color: '#61dafb' },
    { key: '6M', color: '#4CAF50' }
  ];

  // Generate data based on selected period
  const generateTrendData = (period) => {
    let dataPoints;
    switch(period) {
      case 'Today':
        dataPoints = 24; // 24 hours
        break;
      case '3M':
        dataPoints = 90; // 90 days
        break;
      case '6M':
        dataPoints = 180; // 180 days
        break;
      default:
        dataPoints = 24;
    }

    return Array.from({ length: dataPoints }, (_, i) => ({
      name: period === 'Today' ? `${i}:00` : `${i + 1}`,
      route: Math.floor(Math.random() * 40) + 10,
      power: Math.floor(Math.random() * 30) + 10,
      stoppage: Math.floor(Math.random() * 45) + 10,
      speeding: Math.floor(Math.random() * 35) + 10,
      night: Math.floor(Math.random() * 25) + 10,
      noHalt: Math.floor(Math.random() * 20) + 10,
      offline: Math.floor(Math.random() * 15) + 10,
      tampering: Math.floor(Math.random() * 10) + 5
    }));
  };

  const [trendData, setTrendData] = useState(generateTrendData('Today'));

  const handlePeriodChange = (period) => {
    setActivePeriod(period);
    setTrendData(generateTrendData(period));
  };

  // IRIS chart data
  const operabilityData = [
    { name: 'RDI', value: 75, color: '#9575cd' },
    { name: 'RO', value: 90, color: '#ff4081' },
    { name: 'LPG', value: 99, color: '#4dd0e1' },
    { name: 'RT', value: 99, color: '#4fc3f7' },
  ];

  const violations = [
    { icon: <RouteIcon />, label: 'Route Deviation' },
    { icon: <PowerIcon />, label: 'Power Disconnect' },
    { icon: <PanToolIcon />, label: 'Unauthorized Stoppage' },
    { icon: <SpeedIcon />, label: 'Speeding' },
    { icon: <NightlightIcon />, label: 'Night Driving' },
    { icon: <DoNotDisturbOnIcon />, label: 'No Halt Zone' },
    { icon: <SignalCellularOffIcon />, label: 'Offline' },
    { icon: <BuildIcon />, label: 'Device Tampering' }
  ];

  // Get X-axis interval based on period
  const getXAxisInterval = () => {
    switch(activePeriod) {
      case 'Today':
        return 2;
      case '3M':
        return 15;
      case '6M':
        return 30;
      default:
        return 2;
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Violations Trend Card */}
      <Card sx={{ bgcolor: '#1a1a2e', boxShadow: 'none', border: '1px solid rgba(255,255,255,0.1)' }}>
        <CardContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" color="white" gutterBottom>
              VTS VIOLATIONS TREND From : 20/09/2024
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              {periodButtons.map((button) => (
                <button
                  key={button.key}
                  onClick={() => handlePeriodChange(button.key)}
                  style={{
                    backgroundColor: activePeriod === button.key ? button.color : 'rgba(255,255,255,0.1)',
                    color: activePeriod === button.key ? 'white' : '#666',
                    border: 'none',
                    padding: '6px 16px',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: activePeriod === button.key ? `0 0 10px ${button.color}40` : 'none',
                    fontSize: '0.875rem'
                  }}
                >
                  {button.key}
                </button>
              ))}
            </Box>
          </Box>

          {/* Line Chart */}
          <Box sx={{ height: 150, mb: 2 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <XAxis
                  dataKey="name"
                  stroke="white"
                  interval={getXAxisInterval()}
                />
                <YAxis stroke="white" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#2a2640',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                />
                <Line type="monotone" dataKey="route" stroke="#4fc3f7" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="power" stroke="#4dd0e1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="stoppage" stroke="#ff4081" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="speeding" stroke="#9575cd" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Box>

          {/* Violations Legend */}
          <Grid container spacing={1}>
            {violations.map((violation, index) => (
              <Grid item xs={6} key={index}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'white' }}>
                  {violation.icon}
                  <Typography variant="caption">
                    {violation.label}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* IRIS Operability Card */}
      <Card sx={{ bgcolor: '#1a1a2e', boxShadow: 'none', border: '1px solid rgba(255,255,255,0.1)' }}>
        <CardContent>
          {/* <Typography variant="h6" color="white" gutterBottom>
            OPERABILITY INDEX TODAY - (20-Dec-2024)
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', height: 200 }}>

            <Solidgaugechart/>
            <Box sx={{ position: 'absolute', top: 0, right: 20 }}>
              {operabilityData.map((item, index) => (
                <Typography key={index} color="white" variant="caption" display="block">
                  {item.value}% {item.name}
                </Typography>
              ))}
            </Box>
          </Box> */}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ViolationsTrend;