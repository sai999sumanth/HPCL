import React, { useState, useRef, useEffect } from 'react';
import { Tabs, TabList, TabPanels, Tab, TabPanel } from '@chakra-ui/react';
import { useParams, useNavigate } from 'react-router-dom';
import Projects from '../../projects/Projects';
import { ROAlertsTable } from '../alertsTable/ROAlertsTable';
import { SeverityProvider } from '../../projects/Projects';
import HorizontalStackedBarChart from '../RetailTerminalHome/HorizontalStackedBarChart';
import StackedBarChart from '../RetailTerminalHome/StackedBarChart';
import InterlockStackedBarChart from '../RetailTerminalHome/InterlockStackedBarChart';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/@/components/ui/breadcrumb';
import TimeFilterButtons from '../RetailOutletHome/TimeFilterButtons';
import axios from "axios";
import ROAlertsTableV2 from '../alertsTable/AlertTableV2';
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
}
interface LocationFilter {
  zone: string | null;
  plant: string | null;
}

const EMLOCKHome: React.FC = () => {
  const { sapId } = useParams<{ sapId?: string }>();
  const navigate = useNavigate();
  
  const businessUnits = [{ id: 8, bu: 'TAS', alert_section: 'EMLock' }];
  const businessUnits1 = [{ id: 8, bu: 'LPG', alert_section: 'EMLock' }];

  const [timeFilter, setTimeFilter] = useState('t');
  const [dateRangeFilter, setDateRangeFilter] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [loadedTabs, setLoadedTabs] = useState<Set<number>>(new Set([0]));
  const tableRef = useRef<HTMLDivElement>(null);

  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>({
    severity: null,
    section: 'EMLock',
    interlockName: null,
    bu: 'TAS'
  });

  const [titleFilter, setTitleFilter] = useState<TitleFilter>({
    id: null,
    title: null,
    bu: 'TAS'
  });
  const [locationFilter, setLocationFilter] = useState<LocationFilter>({
    zone: null,
    plant: null
  });

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


  const getTimeFilterQuery = (filter: string | null): string => {
    if (!filter) return '';
    
    const timeFilterMap: { [key: string]: string } = {
      't': "created_at::DATE = CURRENT_DATE",
      '1d': "created_at::DATE = CURRENT_DATE - INTERVAL '1 DAY'",
      '1w': "created_at::DATE >= CURRENT_DATE - INTERVAL '7 DAY'",
      '15d': "created_at::DATE >= CURRENT_DATE - INTERVAL '15 DAY'",
      '1m': "created_at::DATE >= CURRENT_DATE - INTERVAL '1 MONTH'",
      '3m': "created_at::DATE >= CURRENT_DATE - INTERVAL '3 MONTH'"
    };

    return timeFilterMap[filter] || '';
  };

  const handleTimeFilterChange = (filter: string) => {
    const filterMap: { [key: string]: string } = {
      'today': 't',
      'yesterday': 'y',
      '1week': '1w',
      '1month': '1m',
      '3months': '3m'
    };
    
    setSeverityFilter({
      severity: null,
      section: 'EMLock',
      interlockName: null,
      bu: 'TAS'
    });
    
    setTitleFilter({
      id: null,
      title: null,
      bu: 'TAS'
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
      bu
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
      bu
    });
    
    setSeverityFilter({
      severity: null,
      section: 'EMLock',
      interlockName: null,
      bu
    });

    tableRef.current?.scrollIntoView({ 
      behavior: 'auto',
      block: 'start'
    });
  };

  const getQuery = (baseStatus: string, tabIndex: number): string => {
    let baseQuery = `alert_section='EMLock' AND alert_status='${baseStatus}'`;

    // Add specialized queries for My Inbox and Escalation Inbox
    if (tabIndex === 0) {
      // My Inbox
      baseQuery += ` AND assigned_user_roles = '{${userInfo.novex_role}}'`;
    } else if (tabIndex === 2) {
      // Escalation Inbox
      baseQuery += ` AND assigned_user_roles != '{}'`;
    }

    if (sapId) {
      baseQuery += ` AND sap_id='${sapId}'`;
    }

    // Add business unit filter based on title or severity filter
    if (titleFilter.title) {
      baseQuery += ` AND bu='${titleFilter.bu}'`;
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
      const timeFilterQuery = getTimeFilterQuery(timeFilter);
      if (timeFilterQuery) {
        baseQuery += ` AND ${timeFilterQuery}`;
      }
    } else if (dateRangeFilter) {
      const [startDate, endDate] = dateRangeFilter.value.split(",");
      baseQuery += ` AND created_at::DATE BETWEEN '${startDate}' AND '${endDate}'`;
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
      section: 'EMLock',
      interlockName: null,
      bu: 'TAS'
    });
    
    setTitleFilter({
      id: null,
      title: null,
      bu: 'TAS'
    });
    
    setDateRangeFilter(dateFilter);
    setTimeFilter(null);
  };

  const getCurrentBU = () => {
    return titleFilter.bu || severityFilter.bu || 'TAS';
  };

  const handleLocationChange = (locationId: string) => {
    setLocationFilter(prev => ({
      ...prev,
      plant: locationId
    }));
  };

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
                <BreadcrumbPage className="text-gray-900">EMLock Home</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <TimeFilterButtons
            selectedFilter={timeFilter}
            onFilterChange={handleTimeFilterChange}
            onDateRangeChange={handleDateRangeChange}
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 p-1">
        {!sapId && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-2">
              <Projects
                units={businessUnits}
                title="SOD Terminal"
                onSeverityFilter={(severity, interlockName) =>
                  handleSeverityFilter(severity, interlockName, 'EMLock', 'TAS')}
                onTitleClick={(id, title) => handleTitleClick(id, title, 'TAS')}
                showAdditionalCards={false}
                timeFilter={timeFilter || dateRangeFilter}
                locationFilter={locationFilter}

              />
              <Projects
                units={businessUnits1}
                title="LPG"
                onSeverityFilter={(severity, interlockName) =>
                  handleSeverityFilter(severity, interlockName, 'EMLock', 'LPG')}
                onTitleClick={(id, title) => handleTitleClick(id, title, 'LPG')}
                showAdditionalCards={false}
                timeFilter={timeFilter || dateRangeFilter}
                locationFilter={locationFilter}

              />
            </div>

            <div className="ml-1 grid grid-cols-3 md:grid-cols-1 lg:grid-cols-3 gap-2">
              {[
                <StackedBarChart 
                  bu={getCurrentBU()} 
                  alert_section="EMLock" 
                  timeFilter={timeFilter || dateRangeFilter} 
                  locationFilter={locationFilter}

                />,
                <HorizontalStackedBarChart 
                  bu={getCurrentBU()} 
                  alert_section="EMLock"
                  timeFilter={timeFilter || dateRangeFilter} 
                  locationFilter={locationFilter}

                />,
                <InterlockStackedBarChart 
                  bu={getCurrentBU()} 
                  alert_section="EMLock"
                  timeFilter={timeFilter || dateRangeFilter} 
                  locationFilter={locationFilter}

                />
              ].map((chart, index) => (
                <div
                  key={index}
                  className="p-4 rounded-md p-1.5 border border-gray-200 text-[10px] bg-white shadow"
                >
                  {chart}
                </div>
              ))}
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
                  />
                )}
              </TabPanel>
              <TabPanel>
                {loadedTabs.has(1) && (
                  <ROAlertsTableV2
                    query={getQuery('Open',1)}
                    onLocationChange={handleLocationChange}
                    key={`open-${severityFilter.bu}-${severityFilter.severity}-${severityFilter.section}-${sapId}`}
                  />
                )}
              </TabPanel>
              <TabPanel>
                {loadedTabs.has(2) && (
                  <ROAlertsTableV2
                    query={getQuery('Open',2)}
                    onLocationChange={handleLocationChange}
                    key={`open-${severityFilter.bu}-${severityFilter.severity}-${severityFilter.section}-${sapId}`}
                  />
                )}
              </TabPanel>
              <TabPanel>
                {loadedTabs.has(3) && (
                  <ROAlertsTableV2
                    query={getQuery('Close',3)}
                    onLocationChange={handleLocationChange}
                    key={`closed-${severityFilter.bu}-${severityFilter.severity}-${severityFilter.section}-${sapId}`}
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

export default EMLOCKHome;