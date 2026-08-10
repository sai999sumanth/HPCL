import React, { useState, useRef, useEffect } from 'react';
import { Tabs, TabList, TabPanels, Tab, TabPanel } from '@chakra-ui/react';
import { useParams, useNavigate } from 'react-router-dom';
import Projects from '../../projects/Projects';
import { ROAlertsTable } from '../alertsTable/ROAlertsTable';
import { SeverityProvider } from '../../projects/Projects';
import HorizontalStackedBarChart from '../RetailTerminalHome/HorizontalStackedBarChart';
import StackedBarChart from '../RetailTerminalHome/StackedBarChart';
import HourlyBarChart from '../RetailTerminalHome/HourlyBarChart';
import InterlockStackedBarChart from '../RetailTerminalHome/InterlockStackedBarChart';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/@/components/ui/breadcrumb';
import TimeFilterButtons from '../RetailOutletHome/TimeFilterButtons';
import axios from "axios";
import ROAlertsTableV2 from '../alertsTable/AlertTableV2';
import AlertStatusToggle from '../RetailTerminalHome/AlertStatusToggle';
import AlertsTableClosedTab from '../alertsTable/AlertsTableCloseTab';
import { Button } from "@/@/components/ui/button"
import { RotateCcw } from "lucide-react"
import { apiClient } from '@/services/apiClient';

interface SeverityFilter {
  severity: string | null;
  section: string;
  interlockName: string | null;
  bu: string;
}

interface TitleFilter {
  id: number | null;
  title: string | null;
  bu: string;
  alert_section: string | null;
}
interface LocationFilter {
  zone: string | null;
  plant: string | null;
}

const VAHome: React.FC = () => {
  const { sapId } = useParams<{ sapId?: string }>();
  const navigate = useNavigate();
  
  const businessUnits = [{ id: 6, bu: 'RO', alert_section: 'VA' }];
  const businessUnits1 = [{ id: 6, bu: 'TAS', alert_section: 'VA' }];
  const businessUnits2 = [{ id: 6, bu: 'LPG', alert_section: 'VA' }];
  const [alertStatus, setAlertStatus] = useState<string>("Open") // New state for alert status
  const [isLoading, setIsLoading] = useState(false)

  const [timeFilter, setTimeFilter] = useState('t');
  const [dateRangeFilter, setDateRangeFilter] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(1);
  const [loadedTabs, setLoadedTabs] = useState<Set<number>>(new Set([1]));
  const tableRef = useRef<HTMLDivElement>(null);
  const [alertStatusToggle, setAlertStatusToggle] = useState(true) // true = Open, false = Close
  const toggleAlertStatus = () => {
    setAlertStatus((prev) => (prev === "Open" ? "Close" : "Open"))
  }
  const [showCharts, setShowCharts] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>({
    severity: null,
    section: 'VA',
    interlockName: null,
    bu: ''
  });

  const [titleFilter, setTitleFilter] = useState<TitleFilter>({
    id: null,
    title: null,
    bu: 'RO',
    alert_section: null
  });
  const [locationFilter, setLocationFilter] = useState<LocationFilter>({
    zone: null,
    plant: null
  });

  useEffect(() => {
    localStorage.removeItem('sapId');
    localStorage.removeItem('zone');
    const timer = setTimeout(() => {
      setShowCharts(true);
    }, 500);
  }, []);

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => { 
    try { 
      const response = await apiClient.get("/api/session/me");
      setUserInfo(response.data);
      console.log("Fetched user info:", response.data);
    } catch (error) {
      console.error("Error fetching user info:", error);
    }
  };
  const [userInfo, setUserInfo] = useState<any>({});

  const handleZoneChange = (zone: string) => {
    setLocationFilter(prev => ({
      ...prev,
      zone,
      plant: null
    }));
  };

  const handlePlantChange = (plant: string) => {
    setLocationFilter(prev => ({
      ...prev,
      plant
    }));
  };

  const createdAtIstDate = "(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE";
  const closedAtIstDate = "(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE";

  const getTimeFilterQuery = (filter: string | null): string => {
    if (!filter) return '';
    
    const timeFilterMap: { [key: string]: string } = {
      't': `${createdAtIstDate} = CURRENT_DATE`,
      '1d': `${createdAtIstDate} = CURRENT_DATE - INTERVAL '1 DAY'`,
      '1w': `${createdAtIstDate} >= CURRENT_DATE - INTERVAL '7 DAY'`,
      '15d': `${createdAtIstDate} >= CURRENT_DATE - INTERVAL '15 DAY'`,
      '1m': `${createdAtIstDate} >= CURRENT_DATE - INTERVAL '1 MONTH'`,
      '3m': `${createdAtIstDate} >= CURRENT_DATE - INTERVAL '3 MONTH'`
    };

    return timeFilterMap[filter] || '';
  };

  const getClosedTimeFilterQuery = (filter: string | null): string => {
    if (!filter) return '';
    
    const timeFilterMap: { [key: string]: string } = {
      't': `${closedAtIstDate} = CURRENT_DATE`,
      '1d': `${closedAtIstDate} = CURRENT_DATE - INTERVAL '1 DAY'`,
      '1w': `${closedAtIstDate} >= CURRENT_DATE - INTERVAL '7 DAY'`,
      '15d': `${closedAtIstDate} >= CURRENT_DATE - INTERVAL '15 DAY'`,
      '1m': `${closedAtIstDate} >= CURRENT_DATE - INTERVAL '1 MONTH'`,
      '3m': `${closedAtIstDate} >= CURRENT_DATE - INTERVAL '3 MONTH'`
    };

    return timeFilterMap[filter] || '';
  };

  const handleTimeFilterChange = (filter: string) => { //
    const filterMap: { [key: string]: string } = {
      'today': 't',
      'yesterday': 'y',
      '1week': '1w',
      '1month': '1m',
      '3months': '3m'
    };
    
    setSeverityFilter({
      severity: null,
      section: null,
      interlockName: null,
      bu: 'RO'
    });
    
    setTitleFilter({
      id: null,
      title: null,
      bu: 'RO',
      alert_section: null
    });
    
    setTimeFilter(filterMap[filter] || filter);
  };

  const handleSeverityFilter = (severity: string | null, interlockName: string | null, section: string, bu: string) => {
    setSeverityFilter({
      severity,
      section,
      interlockName,
      bu
    });
    
    setTitleFilter({
      id: null,
      title: null,
      bu,
      alert_section: null
    });
    
    tableRef.current?.scrollIntoView({ 
      behavior: 'auto',
      block: 'start'
    });
  };
  const handleTitleClick = (cardId: number, cardTitle: string, bu: string) => {
    setTitleFilter({
      id: cardId,
      title: cardTitle,
      bu: bu, // Explicitly pass the business unit from the clicked card
      alert_section: null
    });
    
    setSeverityFilter({
      severity: null,
      section: 'VA',
      interlockName: null,
      bu: bu // Also update the severity filter with the correct business unit
    });

    tableRef.current?.scrollIntoView({ 
      behavior: 'auto',
      block: 'start'
    });
  };


  const getQuery = (baseStatus: string, tabIndex: number): string => {
    let baseQuery = `alert_section='VA' AND alert_status='${baseStatus}'`;
    
    if (tabIndex === 0) { // My Inbox
      // Check if userInfo.novex_role exists before trying to map over it
      if (userInfo && userInfo.novex_role && Array.isArray(userInfo.novex_role)) {
        const roleConditions = userInfo.novex_role.map(role => `'${role}' = ANY(assigned_user_roles)`).join(' OR ');
        if (roleConditions) {
          baseQuery += ` AND (${roleConditions})`;
        }
      }
    } else if (tabIndex === 2) { // Escalation Inbox
      baseQuery += ` AND assigned_user_roles != '{}'`;
    }
    
    if (sapId) {
      baseQuery += ` AND sap_id='${sapId}'`;
    }
    
  // Modify the business unit filter logic
  if (titleFilter.title) {
    baseQuery += ` AND bu='${titleFilter.bu}'`; // Use the explicitly set bu
  } else if (severityFilter.bu) {
    baseQuery += ` AND bu='${severityFilter.bu}'`;
  }
    if (severityFilter.severity) {
      baseQuery += ` AND severity='${severityFilter.severity}'`;
    }
    
    if (severityFilter.interlockName) {
      baseQuery += ` AND interlock_name='${severityFilter.interlockName}'`;
    }
    if (locationFilter.zone) {
      baseQuery += ` AND zone='${locationFilter.zone}'`;
    }
    if (locationFilter.plant) {
      baseQuery += ` AND sap_id='${locationFilter.plant}'`;
    }


    if (timeFilter) {
      const timeFilterQuery = baseStatus === "Close" ? getClosedTimeFilterQuery(timeFilter) : getTimeFilterQuery(timeFilter);
      if (timeFilterQuery) {
        baseQuery += ` AND ${timeFilterQuery}`;
      }
    } else if (dateRangeFilter) {
      const [startDate, endDate] = dateRangeFilter.value.split(',');
      if (baseStatus === "Close") {
        baseQuery += ` AND ${closedAtIstDate} BETWEEN '${startDate}' AND '${endDate}'`;
      } else {
        baseQuery += ` AND ${createdAtIstDate} BETWEEN '${startDate}' AND '${endDate}'`;
      }
    }
    
    return baseQuery;
  };

  const handleTabChange = (index: number) => {
    setActiveTab(index);
    setLoadedTabs((prev) => new Set([...prev, index]));
  };

  const handleDateRangeChange = (dateFilter: any) => {
    setSeverityFilter({
      severity: null,
      section: 'VA',
      interlockName: null,
      bu: 'RO'
    });
    
    setTitleFilter({
      id: null,
      title: null,
      bu: 'RO',
      alert_section: null
    });
    
    setDateRangeFilter(dateFilter);
    setTimeFilter(null);
  };

  const getCurrentBU = () => {
    return titleFilter.bu || severityFilter.bu || 'RO';
  };

  const handleLocationChange = (locationId: string) => {
    setLocationFilter(prev => ({
      ...prev,
      plant: locationId
    }));
  };
  const [resetTrigger, setResetTrigger] = useState(0);

  const handleRefresh = () => {
      setIsLoading(true);
      
      // Your existing reset code...
      setLocationFilter({
        zone: null,
        plant: null,
      });
      handleZoneChange(null);
      handlePlantChange(null);
      
      setTimeFilter("t"); // This sets it back to "Today"
      setDateRangeFilter(null);
      localStorage.removeItem('sapId');
      localStorage.removeItem('zone');      
      // Increment reset trigger to notify child components
      setResetTrigger(prev => prev + 1);
      
      fetchUserInfo();
      
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
  }
  return (
    <div className="flex flex-col min-h-screen bg-white rounded-lg shadow-md">
      <SeverityProvider>
        <div className="flex-shrink-0 sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm flex items-center justify-between px-1 py-1">
          <Breadcrumb>
            <BreadcrumbList className="flex items-center text-gray-500">
              <BreadcrumbItem>
                <BreadcrumbLink 
                  onClick={() => navigate(-1)} 
                  className="hover:text-gray-700"
                >
                  Home
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbPage className="text-gray-900">VA Home</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          {/* <AlertStatusToggle status={alertStatus} onToggle={toggleAlertStatus} /> */}
          <div className="flex items-center gap-4">

          <TimeFilterButtons
            selectedFilter={timeFilter}
            onFilterChange={handleTimeFilterChange}
            onDateRangeChange={handleDateRangeChange}
            resetTrigger={resetTrigger}
          />
                      <Button
              onClick={handleRefresh}
              className="h-7 px-2 py-1 text-xs font-medium rounded-lg transition-all bg-gradient-to-r from-red-500 to-orange-500 text-white hover:from-gray-200 hover:to-gray-300 border border-gray-300"
              disabled={isLoading}
            >
              {/* Reset */}
              <RotateCcw className="h-4 w-4" />
            </Button>
            </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 p-1">
        {!sapId && (
          <>
            <div className="grid md:grid-cols-1 lg:grid-cols-3 grid-cols-3 gap-2">
              <Projects
              key={`ro-${resetTrigger}`}
                units={businessUnits}
                title="RO"
                onSeverityFilter={(severity, interlockName) =>
                  handleSeverityFilter(severity, interlockName, 'VA', 'RO')}
                onTitleClick={(id, title) => handleTitleClick(id, title, 'RO')} // Explicitly pass 'RO'
                showAdditionalCards={false}
                timeFilter={timeFilter || dateRangeFilter}
                locationFilter={locationFilter}
                alertStatus={alertStatus}
                resetTrigger={resetTrigger} 
              />
              <Projects
              key={`sod-${resetTrigger}`}
                units={businessUnits1}
                title="SOD"
                onSeverityFilter={(severity, interlockName) =>
                  handleSeverityFilter(severity, interlockName, 'VA', 'TAS')}
                onTitleClick={(id, title) => handleTitleClick(id, title, 'TAS')} // Explicitly pass 'TAS'
                showAdditionalCards={false}
                timeFilter={timeFilter || dateRangeFilter}
                locationFilter={locationFilter}
                alertStatus={alertStatus}
                resetTrigger={resetTrigger} 
              />
              <Projects
              key={`lpg-${resetTrigger}`}
                units={businessUnits2}
                title="LPG"
                onSeverityFilter={(severity, interlockName) =>
                  handleSeverityFilter(severity, interlockName, 'VA', 'LPG')}
                onTitleClick={(id, title) => handleTitleClick(id, title, 'LPG')} // Explicitly pass 'LPG'
                showAdditionalCards={false}
                timeFilter={timeFilter || dateRangeFilter}
                locationFilter={locationFilter}
                alertStatus={alertStatus}
                resetTrigger={resetTrigger} 
              />
            </div>

            <div className="ml-1 grid grid-cols-3 md:grid-cols-1 lg:grid-cols-3 gap-2">
            {showCharts &&
                [
                  <StackedBarChart
                    key="stacked"
                    bu={getCurrentBU()}
                    alert_section="VA"
                    timeFilter={timeFilter || dateRangeFilter}
                    locationFilter={locationFilter}
                    alertStatus={alertStatus}
                  />,
                  <HorizontalStackedBarChart
                    key="horizontal"
                    bu={getCurrentBU()}
                    alert_section="VA"
                    timeFilter={timeFilter || dateRangeFilter}
                    locationFilter={locationFilter}
                    alertStatus={alertStatus}
                  />,
                  <InterlockStackedBarChart
                    key="interlock"
                    bu={getCurrentBU()}
                    alert_section="VA"
                    timeFilter={timeFilter || dateRangeFilter}
                    locationFilter={locationFilter}
                  />,
                ].map((chart, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-md p-1.5 border border-gray-200 text-[10px] bg-white shadow"
                  >
                    {chart}
                  </div>
                ))
              }
            </div>
          </>
        )}

        <div
          ref={tableRef}
          className="rounded-md border border-gray-200 text-sm bg-white shadow"
        >
          <Tabs
            variant="unstyled"
            className="w-full"
            index={activeTab}
            onChange={handleTabChange}
          >
            <TabList className="flex border-b">
              {['My Inbox','Open Alerts','Escalation Alerts','Closed Alerts'].map((tabName, index) => (
                <Tab
                  key={tabName}
                  className={`relative px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === index ? 'text-blue-500' : 'text-gray-600'
                  }`}
                >
                  {tabName}
                  {activeTab === index && (
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400 rounded-full" />
                  )}
                </Tab>
              ))}
            </TabList>

            <TabPanels className="p-4">
              <TabPanel>
                {loadedTabs.has(0) && (
                  <ROAlertsTable
                    query={getQuery('Open',0)}
                    onLocationChange={handleLocationChange}
                    key={`open-${severityFilter.bu}-${severityFilter.severity}-${severityFilter.section}-${sapId}`}
                    useCreatedAtForCreatedAtColumn={true}
                  />
                )}
              </TabPanel>
              <TabPanel>
                {loadedTabs.has(1) && (
                  <ROAlertsTableV2
                    query={getQuery('Open',1)}
                    hiddenColumns={['assigned_user_roles', 'last_escalated_to']}
                    onLocationChange={handleLocationChange}
                    key={`open-${severityFilter.bu}-${severityFilter.severity}-${severityFilter.section}-${sapId}`}
                    useCreatedAtForCreatedAtColumn={true}
                  />
                )}
              </TabPanel>
              <TabPanel>
                {loadedTabs.has(2) && (
                  <ROAlertsTableV2
                    query={getQuery('Open',2)}
                    onLocationChange={handleLocationChange}
                    key={`open-${severityFilter.bu}-${severityFilter.severity}-${severityFilter.section}-${sapId}`}
                    useCreatedAtForCreatedAtColumn={true}
                  />
                )}
              </TabPanel>


              <TabPanel>
                {loadedTabs.has(3) && (
                  <AlertsTableClosedTab
                    query={getQuery('Close',3)}
                    hiddenColumns={['assigned_user_roles', 'last_escalated_to']}
                    onLocationChange={handleLocationChange}
                    key={`closed-${severityFilter.bu}-${severityFilter.severity}-${severityFilter.section}-${sapId}`}
                    useCreatedAtForCreatedAtColumn={true}
                  />
                )}
              </TabPanel>
            </TabPanels>
          </Tabs>
        </div>
        </div>
      </SeverityProvider>
    </div>
  );
};

export default VAHome;