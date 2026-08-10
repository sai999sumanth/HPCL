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
import VTSAlertsTable from '../alertsTable/VTSAlertsTable';
import VTSAlertsTableV2 from '../alertsTable/VTSAlertsTAbleV2';
import VTSAlertsTableClosedTab from '../alertsTable/VTSAlertsTableClosedTab';
import { Button } from "@/@/components/ui/button"
import { RotateCcw } from "lucide-react"
import { apiClient } from '@/services/apiClient';
import ZonePlantSelections from '../RetailOutletHome/ZonePlantSelections';
import VTSViolationTable from './VTSViolationTable';
import VTSViolationAlertsTableV2 from './VTSViolationTableV2';
import VTSViolationTableClosedTab from './VTSViolationTableClosedTab';
import VTSProjects from './VTSProjects';
import VTSVehicleAI from '../Governance/VTS/VTSVehicleAI';

interface SeverityFilter {
  severity: string | null;
  section: string;
  interlockName: string | null;
  bu?: string;
}

interface TitleFilter {
  id: number | null;
  title: string | null;
  bu: string;
  tt_type?: string | null;
}
interface LocationFilter {
  zone: string | null;
  plant: string | null;
}

const VTSViolationHome: React.FC = () => {
  const { sapId } = useParams<{ sapId?: string }>();
  const navigate = useNavigate();

  const businessUnits = [{ id: 7, bu: 'TAS', alert_section: 'VTS' }];
  const businessUnitsLpgBulk = [{ id: 7, bu: 'LPG', alert_section: 'VTS' }];
  const businessUnitsLpgPacked = [{ id: 9, bu: 'LPG', alert_section: 'VTS' }];
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
    section: 'VTS',
    interlockName: null,
    // bu: 'TAS'
  });

  const [titleFilter, setTitleFilter] = useState<TitleFilter>({
    id: null,
    title: null,
    bu: 'TAS',
    tt_type: null
  });
  const [ttTypeFilter, setTtTypeFilter] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState<LocationFilter>({
    zone: null,
    plant: null
  });

  // Zone and Plant filter states for ZonePlantSelections component
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<string | null>(null);
  const [selectedBu, setSelectedBu] = useState<string>('TAS');

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

  // Handler functions for ZonePlantSelections component
  const onZoneChange = (zone: string | null) => {
    setSelectedZone(zone);
    setLocationFilter(prev => ({
      ...prev,
      zone,
      plant: null // Reset plant when zone changes
    }));
  };

  const onPlantChange = (plant: string | null, zone: string | null) => {
    setSelectedPlant(plant);
    setLocationFilter(prev => ({
      ...prev,
      plant,
      zone: zone || prev.zone
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
      section: 'VTS',
      interlockName: null,
      bu: 'TAS'
    });

    setTitleFilter({
      id: null,
      title: null,
      bu: 'TAS',
      tt_type: null
    });
    setTtTypeFilter(null);

    setTimeFilter(filterMap[filter] || filter);
  };

  const handleSeverityFilter = (severity: string | null, interlockName: string | null, section: string, bu: string, tt_type?: string | null) => {
    setSeverityFilter({
      severity,
      section,
      interlockName,
      bu
    });
    setTtTypeFilter(bu === 'LPG' && tt_type ? tt_type : null);

    setTitleFilter({
      id: null,
      title: null,
      bu,
      tt_type: null
    });

    tableRef.current?.scrollIntoView({
      behavior: 'auto',
      block: 'start'
    });
  };

  const handleTitleClick = (cardId: number, cardTitle: string, bu: string, tt_type?: string | null) => {
    setTitleFilter({
      id: cardId,
      title: cardTitle,
      bu,
      tt_type: tt_type ?? null
    });
    setTtTypeFilter(null);

    setSeverityFilter({
      severity: null,
      section: 'VTS',
      interlockName: null,
      bu
    });

    tableRef.current?.scrollIntoView({
      behavior: 'auto',
      block: 'start'
    });
  };

  const getQuery = (baseStatus: string, tabIndex: number): string => {
    let baseQuery = `alert_section='VTS' AND alert_status='${baseStatus}'`;

    // Add specialized queries for My Inbox and Escalation Inbox
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

    // Add business unit filter based on title or severity filter
    if (titleFilter.title) {
      baseQuery += ` AND bu='${titleFilter.bu}'`;
    } else if (severityFilter.bu) {
      baseQuery += ` AND bu='${severityFilter.bu}'`;
    }

    // Add tt_type for LPG (Bulk / Packed)
    const effectiveTtType = titleFilter.bu === 'LPG' && titleFilter.tt_type ? titleFilter.tt_type : (severityFilter.bu === 'LPG' && ttTypeFilter ? ttTypeFilter : null);
    if (effectiveTtType) {
      baseQuery += ` AND tt_type='${effectiveTtType}'`;
    }

    if (severityFilter.severity) {
      baseQuery += ` AND severity='${severityFilter.severity}'`;
    }

    if (severityFilter.interlockName) {
      baseQuery += ` AND violation_name='${severityFilter.interlockName}'`;
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
      section: 'VTS',
      interlockName: null,
      bu: 'TAS'
    });
    setTtTypeFilter(null);

    setTitleFilter({
      id: null,
      title: null,
      bu: 'TAS',
      tt_type: null
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
  const [resetTrigger, setResetTrigger] = useState(0);

  const handleRefresh = () => {
      setIsLoading(true);
      
      // Your existing reset code...
      setLocationFilter({
        zone: null,
        plant: null,
      });
      setSelectedZone(null);
      setSelectedPlant(null);
      handleZoneChange(null);
      handlePlantChange(null);
      
      setTtTypeFilter(null);
      setTitleFilter({
        id: null,
        title: null,
        bu: 'TAS',
        tt_type: null
      });
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
      <div className="flex-shrink-0 sticky top-0 z-20 bg-white shadow-sm">
        <VTSVehicleAI />
        <div className="flex items-center justify-between px-1 py-1 border-b border-gray-200 bg-white">
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
                <BreadcrumbPage className="text-gray-900">VTS Violation Home</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          {/* <AlertStatusToggle status={alertStatus} onToggle={toggleAlertStatus} /> */}
          <div className="flex items-center gap-4">
        <ZonePlantSelections
          zone={selectedZone}
          sapid={selectedPlant}
          onZoneChange={onZoneChange}
          onPlantChange={onPlantChange}
          bu={selectedBu === 'SOD' ? 'TAS' : selectedBu}
        />
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
      </div>
      <SeverityProvider>
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 p-1">
        {!sapId && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              <VTSProjects
                key={`sod-terminal-${resetTrigger}`}
                units={businessUnits}
                title="SOD Terminal"
                onSeverityFilter={(severity, interlockName) =>
                  handleSeverityFilter(severity, interlockName, 'VTS', 'TAS')}
                onTitleClick={(id, title) => handleTitleClick(id, title, 'TAS')}
                showAdditionalCards={false}
                timeFilter={timeFilter || dateRangeFilter}
                locationFilter={locationFilter}
                alertStatus={alertStatus}
                resetTrigger={resetTrigger}
              />
              <VTSProjects
                key={`lpg-bulk-${resetTrigger}`}
                units={businessUnitsLpgBulk}
                title="LPG Bulk"
                ttType="bulk"
                onSeverityFilter={(severity, interlockName) =>
                  handleSeverityFilter(severity, interlockName, 'VTS', 'LPG', 'bulk')}
                onTitleClick={(id, title) => handleTitleClick(id, title, 'LPG', 'bulk')}
                showAdditionalCards={false}
                timeFilter={timeFilter || dateRangeFilter}
                locationFilter={locationFilter}
                alertStatus={alertStatus}
                resetTrigger={resetTrigger}
              />
              <VTSProjects
                key={`lpg-packed-${resetTrigger}`}
                units={businessUnitsLpgPacked}
                title="LPG Packed"
                ttType="packed"
                onSeverityFilter={(severity, interlockName) =>
                  handleSeverityFilter(severity, interlockName, 'VTS', 'LPG', 'packed')}
                onTitleClick={(id, title) => handleTitleClick(id, title, 'LPG', 'packed')}
                showAdditionalCards={false}
                timeFilter={timeFilter || dateRangeFilter}
                locationFilter={locationFilter}
                alertStatus={alertStatus}
                resetTrigger={resetTrigger}
              />
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
              {['My Inbox', 'Open violation', 'Escalation violation', 'Closed violation'].map((tabName, index) => (
                <Tab
                  key={tabName}
                  className={`relative px-4 py-2 text-sm font-medium transition-colors ${activeTab === index ? 'text-blue-500' : 'text-gray-600'
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
                  <VTSViolationTable
                    query={getQuery('Open', 0)}
                    onLocationChange={handleLocationChange}
                    key={`open-${severityFilter.bu}-${severityFilter.severity}-${severityFilter.section}-${titleFilter.tt_type ?? ""}-${ttTypeFilter ?? ""}-${sapId}`}
                  />
                )}
              </TabPanel>
              <TabPanel>
                {loadedTabs.has(1) && (
                  <VTSViolationAlertsTableV2
                    query={getQuery('Open', 1)}
                    onLocationChange={handleLocationChange}
                    hiddenColumns={['assigned_user_roles', 'last_escalated_to']}
                    key={`open-${severityFilter.bu}-${severityFilter.severity}-${severityFilter.section}-${titleFilter.tt_type ?? ""}-${ttTypeFilter ?? ""}-${sapId}`}
                  />
                )}
              </TabPanel>
              <TabPanel>
                {loadedTabs.has(2) && (
                  <VTSViolationAlertsTableV2
                    query={getQuery('Open', 2)}
                    onLocationChange={handleLocationChange}
                    key={`open-${severityFilter.bu}-${severityFilter.severity}-${severityFilter.section}-${titleFilter.tt_type ?? ""}-${ttTypeFilter ?? ""}-${sapId}`}
                  />
                )}
              </TabPanel>
              <TabPanel>
                {loadedTabs.has(3) && (
                  <VTSViolationTableClosedTab
                    query={getQuery('Close', 3)}
                    onLocationChange={handleLocationChange}
                    hiddenColumns={['assigned_user_roles', 'last_escalated_to']}
                    key={`closed-${severityFilter.bu}-${severityFilter.severity}-${severityFilter.section}-${titleFilter.tt_type ?? ""}-${ttTypeFilter ?? ""}-${sapId}`}
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

export default VTSViolationHome;