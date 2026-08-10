import React, { useEffect, useState, ReactElement } from 'react';
import { Box, Card, Grid } from '@mui/material';
// import { ResponsiveContainer } from 'recharts';
// import Charts from './Charts';
// import LineGraph from './LineGraph';
// import SalesPerformanceChart from './PerformanceBarchart';
// import PerformanceV1 from './PerformanceV1';

// import PageChart from './PageChart';
// import Alerts from './Alerts';
// import AmChartsStackedBarChart from './AmChartsStackedBarChart';
// import RejectionChart from '../RetailTerminalHome/LPGRejectionChart';
// import CombinedRateChart from '../RetailTerminalHome/LPGCombinedBarChart';
// import SalesGrowthChart from './SalesGrowthChart';
// import { Button } from "@/@/components/ui/button";
// import { IconChevronLeft, IconChevronRight, IconHome2 } from '@tabler/icons-react';
import { IconHome2 } from '@tabler/icons-react';
// import HourlyBarChartDarkTheme from '../RetailTerminalHome/HourlyBarChartDarkTheme';
// import InterlockBarChartDarkTheme from '../RetailTerminalHome/InterlockBarChartDarkTheme';
// import HorizontalStackedBarChartDarkTheme from '../RetailTerminalHome/HorizontalStackedBarChartDarkTheme';
// import StackedBarChartDarkTheme from '../RetailTerminalHome/StackedBarChartDarkTheme';
import IndiaMap from './IndiaMap/IndiaMap';
// import Indiamap from './Indiamap';
import Map from './map/map';
import { Toaster } from 'sonner';
import assets from '../../../assets';
import { useNavigate } from 'react-router-dom';
// import { RetailDashboard } from './RetailDashBoard/RetailDashboard';
// import { ThemeProvider } from './RetailDashBoard/components/ThemeProvider';

// interface ChartData {
//   ACTUAL_TMT_SALES: { [key: string]: number };
//   TARGET_TMT_SALES: { [key: string]: number };
//   fy_month: { [key: string]: string };
//   month_name: { [key: string]: string };
// }

// interface ChartSection {
//   name: string;
//   color: string;
//   charts: ReactElement[];
//   gridColumns: number;
//   fullWidth?: boolean;
//   fullHeight?: boolean;
// }

const CriticalAlerts: React.FC = () => {
  const navigate = useNavigate();
  // const [selectedSection, setSelectedSection] = useState<string>('Retail');
  // const [chartData, setChartData] = useState<ChartData | null>(null);
  // const [loading, setLoading] = useState<boolean>(true);
  // const [currentChart, setCurrentChart] = useState<'performance' | 'growth'>('performance');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'infra' | 'map'>('map');

  // const handleNextChart = () => {
  //   setCurrentChart(currentChart === 'performance' ? 'growth' : 'performance');
  // };

  // const handlePrevChart = () => {
  //   setCurrentChart(currentChart === 'performance' ? 'growth' : 'performance');
  // };

  // Chart configurations
  // const roCharts: ReactElement[] = [
  //   <HourlyBarChartDarkTheme bu="RO" />,
  //   <InterlockBarChartDarkTheme key="ro-1" bu={'RO'} timeFilter={''} />,
  //   <HorizontalStackedBarChartDarkTheme bu={'RO'} timeFilter={''} />,
  //   <StackedBarChartDarkTheme bu={'RO'} timeFilter={''} />
  // ];

  // const sodCharts: ReactElement[] = [
  //   <AmChartsStackedBarChart
  //     key="sod-1"
  //     bu="TAS"
  //     alert_section="TAS"
  //     alert_status="Open"
  //     title="TAS Alerts"
  //   />,
  //   <AmChartsStackedBarChart
  //     key="sod-2"
  //     bu="TAS"
  //     alert_section="VA"
  //     alert_status="Open"
  //     title="VA Alerts"
  //   />,
  //   <AmChartsStackedBarChart
  //     key="sod-3"
  //     bu="TAS"
  //     alert_section="VTS"
  //     alert_status="Open"
  //     title="VTS Alerts"
  //   />,
  //   <InterlockBarChartDarkTheme key="sod-4" bu={'TAS'} timeFilter={''} />,
  // ];

  // const lpgCharts: ReactElement[] = [
  //   <CombinedRateChart key="lpg-1" />,
  //   <RejectionChart key="lpg-2" />
  // ];

  // const salesCharts: ReactElement[] = [
  //   <SalesPerformanceChart />,
  // ];

  // const chartSections: ChartSection[] = [
  //   // { name: 'Sales', color: '#FCD34D', charts: salesCharts, gridColumns: 1, fullWidth: true, fullHeight: true },
  //   { name: 'Retail', color: '#4ADE80', charts: roCharts, gridColumns: 2 },
  //   { name: 'SOD', color: '#60A5FA', charts: sodCharts, gridColumns: 2 },
  //   { name: 'LPG', color: '#F472B6', charts: lpgCharts, gridColumns: 2, fullWidth: true },
  // ];

  // const handleSectionChange = (sectionName: string) => {
  //   setSelectedSection(sectionName);
  // };

  return (
    <Box sx={{
      flexGrow: 1,
      p: { xs: 1, sm: 0 },
      bgcolor: '#1a1a2e',
      maxWidth: '100%',
      width: '100%',
      height: '100vh',
      overflow: 'auto',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Main Tabs Navigation with Logo */}
      <Box sx={{
        borderBottom: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        mb: 0,
        bgcolor: '#ffffff',
        zIndex: 2,
        display: 'flex',
        alignItems: 'center',
        px: 0,
        py: 0,
        position: 'relative'
      }}>
        {/* HPCL Logo */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center',
          mr: 3,
          ml: 0

        }}>
          <img
            src={assets.images.logo}
            alt="HPCL Logo"
            style={{ height: '50px', margin: '0px 10px' }}
          />
        </Box>

        {/* Tabs */}
        <Box sx={{
          display: 'flex',
          gap: 0
        }}>
          <Box
            onClick={() => setActiveTab('map')}
            sx={{
              px: 1.5,
              py: 1,
              cursor: 'pointer',
              color: activeTab === 'map' ? '#60A5FA' : '#1a1a2e',
              borderBottom: `3px solid ${activeTab === 'map' ? '#60A5FA' : 'transparent'}`,
              fontSize: "16px",
              fontWeight: activeTab === 'map' ? 'bold' : 'normal',
              transition: 'all 0.2s ease',
              '&:hover': {
                color: '#60A5FA',
                backgroundColor: 'rgba(96,165,250,0.05)'
              }
            }}
          >
            Market Infrastructure
          </Box>

          {/* <Box
            onClick={() => setActiveTab('dashboard')}
            sx={{
              px: 1.5,
              py: 1,   
              cursor: 'pointer',
              color: activeTab === 'dashboard' ? '#60A5FA' : '#1a1a2e',
              borderBottom: `3px solid ${activeTab === 'dashboard' ? '#60A5FA' : 'transparent'}`,
              fontSize: "16px",
              fontWeight: activeTab === 'dashboard' ? 'bold' : 'normal',
              transition: 'all 0.2s ease',
              '&:hover': {
                color: '#60A5FA',
                backgroundColor: 'rgba(96,165,250,0.05)'
              }
            }}
          >
            NOVEX Dashboard
          </Box> */}

          {/* <Box
            onClick={() => setActiveTab('infra')}
            sx={{
              px: 1.5,
              py: 1,
              cursor: 'pointer',
              color: activeTab === 'infra' ? '#F472B6' : '#1a1a2e',
              borderBottom: `3px solid ${activeTab === 'infra' ? '#F472B6' : 'transparent'}`,
              fontSize: "16px",
              fontWeight: activeTab === 'infra' ? 'bold' : 'normal',
              transition: 'all 0.2s ease',
              '&:hover': {
                color: '#F472B6',
                backgroundColor: 'rgba(244,114,182,0.05)'
              }
            }}
          >
            HPCL Infra
          </Box> */}
        </Box>

        {/* Center - NOVEX Logo */}
        <Box sx={{ 
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center'
        }}>
          <img
            src={assets.images.novex}
            alt="HPCL Logo"
            className="w-[220px] h-[90px] sm:w-[100px] sm:h-[20px] md:w-[120px] md:h-[22px] lg:w-[220px] lg:h-[100px]"
          />
        </Box>

        {/* Home Button */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center',
          pr: 2,
          ml: 'auto'
        }}>
          <button
            onClick={() => navigate('/sodTerminal/terminalHome')}
            className="flex items-center justify-center text-sm font-bold py-2 px-4 cursor-pointer rounded-full shadow-lg transform transition-transform duration-300 hover:scale-110 bg-gradient-to-l from-blue-400 via-violet-600 to-blue-800 text-white"
          >
            <IconHome2 stroke={1.5} className="w-5 h-5 mr-1" />
            <span>Home</span>
          </button>
        </Box>
      </Box>

      {/* Content based on active tab */}
      {/* {activeTab === 'dashboard' ? (
        <Box sx={{
          flexGrow: 1,
          overflow: 'auto',
          width: '100%',
          maxWidth: '100%',
          height: 'calc(100vh - 120px)',
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'rgba(255,255,255,0.1)',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'rgba(255,255,255,0.3)',
          }
        }}>
          {/* Top Section - KPIs and Performance Chart */}
          {/* <Grid container spacing={1} sx={{ mb: 2, width: '100%', margin: 0 }}>
            <Grid item xs={12}>
              <Card sx={{
                boxShadow: 'none',
                border: '1px solid rgba(255,255,255,0.1)',
                bgcolor: '#1a1a2e',
                mb: 1
              }}>
                <PageChart />
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Card sx={{
                boxShadow: 'none',
                border: '1px solid rgba(255,255,255,0.1)',
                height: '400px',
                bgcolor: '#1a1a2e',
                position: 'relative',
              }}>
                {currentChart === 'performance' ? <PerformanceV1 /> : <SalesGrowthChart />}
                <div className="absolute top-[20%] left-0 transform -translate-y-1/2">
                  <Button
                    onClick={handlePrevChart}
                    className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-full"
                  >
                    <IconChevronLeft size={24} />
                  </Button>
                </div>
                <div className="absolute top-[20%] right-0 transform -translate-y-1/2">
                  <Button
                    onClick={handleNextChart}
                    className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-full"
                  >
                    <IconChevronRight size={24} />
                  </Button>
                </div>
              </Card>
            </Grid>
          </Grid> */}

          {/* Main Content Area - 3 Column Layout */}
          {/* <Grid container spacing={1} sx={{ width: '100%', margin: 0, minHeight: '600px' }}>
            {/* Left Side - Alerts Section */}
            {/* <Grid item xs={12} md={3}>
              <Card sx={{
                bgcolor: '#1a1a2e',
                boxShadow: 'none',
                border: '1px solid rgba(255,255,255,0.1)',
                height: '600px',
                overflow: 'auto',
                '&::-webkit-scrollbar': {
                  width: '6px',
                },
                '&::-webkit-scrollbar-track': {
                  background: 'rgba(255,255,255,0.1)',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: 'rgba(255,255,255,0.2)',
                  borderRadius: '3px',
                },
                '&::-webkit-scrollbar-thumb:hover': {
                  background: 'rgba(255,255,255,0.3)',
                }
              }}>
                <Alerts />
              </Card>
            </Grid> */}

            {/* Center - Tabbed Charts */}
            {/* <Grid item xs={12} md={6}>
              {/* Tabs Navigation */}
              {/* <Box sx={{
                borderBottom: 1,
                borderColor: 'rgba(255,255,255,0.1)',
                mb: 0,
                bgcolor: '#1a1a2e',
                zIndex: 1
              }}>
                <Box sx={{
                  display: 'flex',
                  width: '100%'
                }}>
                  {chartSections.map((section) => (
                    <Box
                      key={section.name}
                      onClick={() => handleSectionChange(section.name)}
                      sx={{
                        flex: 1,
                        px: 1,
                        py: 1.5,
                        cursor: 'pointer',
                        color: selectedSection === section.name ? section.color : 'white',
                        borderBottom: `2px solid ${selectedSection === section.name ? section.color : 'transparent'}`,
                        fontSize: "13px",
                        fontWeight: selectedSection === section.name ? 'bold' : 'normal',
                        transition: 'all 0.2s ease',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        '&:hover': {
                          color: section.color,
                          backgroundColor: 'rgba(255,255,255,0.05)'
                        }
                      }}
                    >
                      {section.name}
                    </Box>
                  ))}
                </Box>
              </Box> */}

              {/* Charts Content */}
              {/* <Box sx={{
                height: '550px',
                overflow: 'auto',
                '&::-webkit-scrollbar': {
                  width: '6px',
                },
                '&::-webkit-scrollbar-track': {
                  background: 'rgba(255,255,255,0.1)',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: 'rgba(255,255,255,0.2)',
                  borderRadius: '3px',
                },
                '&::-webkit-scrollbar-thumb:hover': {
                  background: 'rgba(255,255,255,0.3)',
                }
              }}>
                {chartSections.map(section => {
                  if (section.name === selectedSection) {
                    return (
                      <Grid container spacing={1} key={section.name} sx={{ width: '100%', margin: 0 }}>
                        {section.charts.map((chart, index) => (
                          <Grid
                            item
                            xs={12}
                            md={section.fullWidth ? 12 : 6}
                            key={`${section.name}-chart-${index}`}
                            sx={{ padding: '2px' }}
                          >
                            <Card sx={{
                              bgcolor: '#1a1a2e',
                              boxShadow: 'none',
                              border: '1px solid rgba(255,255,255,0.1)',
                              height: '350px',
                              overflow: 'hidden',
                              '&:hover': {
                                border: `1px solid ${section.color}`
                              }
                            }}>
                              <ResponsiveContainer width="100%" height="100%">
                                {chart}
                              </ResponsiveContainer>
                            </Card>
                          </Grid>
                        ))}
                      </Grid>
                    );
                  }
                  return null;
                })}
              </Box>
            </Grid> */}

            {/* Right Side - India Map */}
            {/* <Grid item xs={12} md={3}>
              <Card sx={{
                bgcolor: '#1a1a2e',
                boxShadow: 'none',
                border: '1px solid rgba(250, 244, 244, 0.1)',
                height: '600px'
              }}>
                <Box sx={{ width: '100%', height: '100%', p: 1 }}>
                  <Indiamap />
                </Box>
              </Card>
            </Grid>
          </Grid>
        </Box>
      ) : */} {activeTab === 'map' ? (
        <Box sx={{ flexGrow: 1, width: '100%', maxWidth: '100%', bgcolor: 'white', height: 'calc(100vh - 120px)' }}>
          <Map />
        </Box>
      ) : (
        <Box sx={{ flexGrow: 1, width: '100%', maxWidth: '100%' }}>
          <Grid container spacing={1} sx={{ width: '100%', margin: 0 }}>
            <Grid item xs={12}>
              <Card sx={{
                bgcolor: '#1a1a2e',
                boxShadow: 'none',
                border: '1px solid rgba(255,255,255,0.1)',
                height: 'calc(100vh - 120px)',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <Box sx={{
                  width: '100%', flexGrow: 1, overflow: 'auto', p: 1,
                  '&::-webkit-scrollbar': { width: '8px' },
                  '&::-webkit-scrollbar-track': { background: 'rgba(255,255,255,0.1)' },
                  '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.2)', borderRadius: '4px' },
                  '&::-webkit-scrollbar-thumb:hover': { background: 'rgba(255,255,255,0.3)' }
                }}>
                  <IndiaMap />
                  <Toaster />
                </Box>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
};

export default CriticalAlerts;