import React, { useState, useRef, useEffect } from 'react';
import { Tabs, TabList, TabPanels, Tab, TabPanel } from '@chakra-ui/react';
import { useParams, useNavigate } from 'react-router-dom';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/@/components/ui/breadcrumb';
import HorizontalStackedBarChart from '../../RetailTerminalHome/HorizontalStackedBarChart';
import StackedBarChart from '../../RetailTerminalHome/StackedBarChart';
import InterlockStackedBarChart from '../../RetailTerminalHome/InterlockStackedBarChart';
import HourlyBarChart from '../../RetailTerminalHome/HourlyBarChart';
import ROAlertsTable from '../../alertsTable/ROAlertsTable';
import Projects, { SeverityProvider } from '@/pages/projects/Projects';
import TimeFilterButtons from '../../RetailOutletHome/TimeFilterButtons';
import ZonePlantSelections from '../../RetailOutletHome/ZonePlantSelections';
import axios from "axios";
import ROAlertsTableV2 from '../../alertsTable/AlertTableV2';
import AmGaugeChart from '../../Wall2/AmGaugeChart';
import AlertStatusToggle from '../../RetailTerminalHome/AlertStatusToggle';
import PerformanceScoreTable from '../../alertsTable/PerformanceScoreTable';
import { Button } from "@/@/components/ui/button"
import { RotateCcw } from "lucide-react"
import AlertsTableClosedTab from '../../alertsTable/AlertsTableCloseTab';
import { apiClient } from '@/services/apiClient';

interface SeverityFilter {
  severity: string | null;
  section: string | null;
  interlockName: string | null;
}
interface LocationFilter {
  zone: string | null;
  plant: string | null;
}

interface TitleFilter {
  id: number | null;
  title: string | null;
  bu: string;
  alert_section: string | null;
  tt_type?: string | null;
}

const LPGHome: React.FC = () => {
  const { sapId } = useParams<{ sapId?: string }>();
  const [activeTab, setActiveTab] = useState(1);
  const [loadedTabs, setLoadedTabs] = useState<Set<number>>(new Set([1]));
  const tableRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [timeFilter, setTimeFilter] = useState('t');
  const [dateRangeFilter, setDateRangeFilter] = useState<any>(null);
  const [alertStatus, setAlertStatus] = useState<string>("Open") // New state for alert status
  const [isLoading, setIsLoading] = useState(false)

  const businessUnits = [{ id: 3, bu: 'LPG', alert_section: 'LPG' }];
  const businessUnits1 = [{ id: 3, bu: 'LPG', alert_section: 'VA' }];
  const businessUnits2VtsBulk = [{ id: 7, bu: 'LPG', alert_section: 'VTS' }];
  const businessUnits2VtsPacked = [{ id: 9, bu: 'LPG', alert_section: 'VTS' }];

  const [titleFilter, setTitleFilter] = useState<TitleFilter>({
    id: null,
    title: null,
    bu: 'LPG',
    alert_section: null,
    tt_type: null
  });
  const [ttTypeFilter, setTtTypeFilter] = useState<string | null>(null);

  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>({
    severity: null,
    section: null,
    interlockName: null
  });
  const [locationFilter, setLocationFilter] = useState<LocationFilter>({
    zone: null,
    plant: null
  });
  const [alertStatusToggle, setAlertStatusToggle] = useState(true) // true = Open, false = Close
  const toggleAlertStatus = () => {
    setAlertStatus((prev) => (prev === "Open" ? "Close" : "Open"))
  }
  useEffect(() => {
    fetchUserInfo();
  }, []);
  const [alertSection, setAlertSection] = useState<string | null>(null);
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
    setLocationFilter((prev) => ({
      ...prev,
      plant,
    }))
  }


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
      '1d': `${closedAtIstDate} >= CURRENT_DATE - INTERVAL '1 DAY'`,
      '1w': `${closedAtIstDate} >= CURRENT_DATE - INTERVAL '7 DAY'`,
      '15d': `${closedAtIstDate} >= CURRENT_DATE - INTERVAL '15 DAY'`,
      '1m': `${closedAtIstDate} >= CURRENT_DATE - INTERVAL '1 MONTH'`,
      '3m': `${closedAtIstDate} >= CURRENT_DATE - INTERVAL '3 MONTH'`
    };

    return timeFilterMap[filter] || '';
  };

  const getPerformanceTimeFilterQuery = (filter: string | null): string => {
    if (!filter) return '';

    const timeFilterMap: { [key: string]: string } = {
      't': "timestamp::DATE = CURRENT_DATE",
      '1d': "timestamp::DATE = CURRENT_DATE - INTERVAL '1 DAY'",
      '1w': "timestamp::DATE >= CURRENT_DATE - INTERVAL '7 DAY'",
      '15d': "timestamp::DATE >= CURRENT_DATE - INTERVAL '15 DAY'",
      '1m': "timestamp::DATE >= CURRENT_DATE - INTERVAL '1 MONTH'",
      '3m': "timestamp::DATE >= CURRENT_DATE - INTERVAL '3 MONTH'"
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

    // Reset all filters
    setSeverityFilter({
      severity: null,
      section: null,
      interlockName: null
    });

    setTitleFilter({
      id: null,
      title: null,
      bu: 'LPG',
      alert_section: null,
      tt_type: null
    });
    setTtTypeFilter(null);

    setTimeFilter(filterMap[filter] || filter);
  };

  const handleTitleClick = (cardId: number, cardTitle: string, bu: string, alert_section: string, tt_type?: string | null) => {
    setTitleFilter({
      id: cardId,
      title: cardTitle,
      bu: bu,
      alert_section: alert_section,
      tt_type: tt_type ?? null
    });
    setTtTypeFilter(null);

    // Reset severity filters when title changes
    setSeverityFilter({
      severity: null,
      section: null,
      interlockName: null
    });
    setAlertSection(alert_section);
    tableRef.current?.scrollIntoView({
      behavior: 'auto',
      block: 'start'
    });
  };

  const handleSeverityFilter = (severity: string | null, interlockName: string | null, section: string, tt_type?: string | null) => {
    setSeverityFilter({
      severity,
      section,
      interlockName
    });
    setTtTypeFilter(section === 'VTS' && tt_type ? tt_type : null);

    // Reset title filter when severity filter changes
    setTitleFilter({
      id: null,
      title: null,
      bu: 'LPG',
      alert_section: null,
      tt_type: null
    });
    setAlertSection(section);
    tableRef.current?.scrollIntoView({
      behavior: 'auto',
      block: 'start'
    });
  };

  const getQuery = (baseStatus: string, tabIndex: number): string => {
    // Base query with essential filters
    let baseQuery = `alert_status='${baseStatus}'`;
    if (tabIndex === 0) { // My Inbox
      // Check if userInfo.novex_role exists before trying to map over it
      if (userInfo && userInfo.novex_role && Array.isArray(userInfo.novex_role)) {
        const roleConditions = userInfo.novex_role.map(role => `'${role}' = ANY(assigned_user_roles)`).join(' OR ');
        if (roleConditions) {
          baseQuery += ` AND (${roleConditions})`;
        }
      }
} else if (tabIndex === 2) { // Escalation Inbox
  baseQuery += ` AND assigned_user_roles != '{}' AND last_escalated_to IS NOT NULL AND last_escalated_to <> '{}'`;
}


    // Add SAP ID filter if present
    if (sapId) {
      baseQuery += ` AND sap_id='${sapId}'`;
    }

    // Only add alert_section filter when explicitly set through user interactions
    if (titleFilter.alert_section) {
      baseQuery += ` AND bu='${titleFilter.bu}' AND alert_section='${titleFilter.alert_section}'`;
    } else if (severityFilter.section) {
      baseQuery += ` AND bu='LPG' AND alert_section='${severityFilter.section}'`;
    } else {
      baseQuery += ` AND bu='LPG'`; // Only add bu filter by default
    }

    // Add severity and interlock filters if present
    if (severityFilter.severity) {
      baseQuery += ` AND severity='${severityFilter.severity}'`;
    }

    if (severityFilter.interlockName) {
      baseQuery += ` AND interlock_name='${severityFilter.interlockName}'`;
    }
    const effectiveTtType = titleFilter.alert_section === 'VTS' && titleFilter.tt_type ? titleFilter.tt_type : (severityFilter.section === 'VTS' && ttTypeFilter ? ttTypeFilter : null);
    if (effectiveTtType) {
      baseQuery += ` AND tt_type='${effectiveTtType}'`;
    }
    if (locationFilter.zone) {
      baseQuery += ` AND zone='${locationFilter.zone}'`;
    }
    if (locationFilter.plant) {
      baseQuery += ` AND sap_id='${locationFilter.plant}'`;
    }


    // Add time/date filters
    if (timeFilter) {
      const timeFilterQuery =
        baseStatus === "Close"
          ? getClosedTimeFilterQuery(timeFilter)
          : getTimeFilterQuery(timeFilter);
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
  const PerformanceQuery = (tabIndex: number): string => {
    let baseQuery = ''; // Start without bu

    if (tabIndex === 0) {
      if (userInfo && userInfo.novex_role && Array.isArray(userInfo.novex_role)) {
        const roleConditions = userInfo.novex_role.map(role => `'${role}' = ANY(assigned_user_roles)`).join(' OR ');
        if (roleConditions) {
          baseQuery += `(${roleConditions})`;
        }
      }
    } else if (tabIndex === 2) {
      baseQuery += `assigned_user_roles != '{}'`;
    }

    // Add SAP ID filter
    if (sapId) {
      baseQuery += (baseQuery ? ' AND ' : '') + `sap_id='${sapId}'`;
    }

    // Handle bu and alert_section
    if (titleFilter.alert_section) {
      baseQuery += (baseQuery ? ' AND ' : '') + `bu='${titleFilter.bu}' AND alert_section='${titleFilter.alert_section}'`;
    } else if (severityFilter.section) {
      baseQuery += (baseQuery ? ' AND ' : '') + `bu='LPG' AND alert_section='${severityFilter.section}'`;
    } else {
      baseQuery += (baseQuery ? ' AND ' : '') + `bu='LPG'`;
    }

    // Add other filters
    if (severityFilter.severity) {
      baseQuery += ` AND severity='${severityFilter.severity}'`;
    }

    if (severityFilter.interlockName) {
      baseQuery += ` AND interlock_name='${severityFilter.interlockName}'`;
    }
    const effectiveTtTypePerf = titleFilter.alert_section === 'VTS' && titleFilter.tt_type ? titleFilter.tt_type : (severityFilter.section === 'VTS' && ttTypeFilter ? ttTypeFilter : null);
    if (effectiveTtTypePerf) {
      baseQuery += ` AND tt_type='${effectiveTtTypePerf}'`;
    }

    if (locationFilter.zone) {
      baseQuery += ` AND zone='${locationFilter.zone}'`;
    }

    if (locationFilter.plant) {
      baseQuery += ` AND sap_id='${locationFilter.plant}'`;
    }

    if (timeFilter) {
      const timeFilterQuery = getPerformanceTimeFilterQuery(timeFilter);
      if (timeFilterQuery) {
        baseQuery += ` AND ${timeFilterQuery}`;
      }
    } else if (dateRangeFilter) {
      const [startDate, endDate] = dateRangeFilter.value.split(',');
      baseQuery += ` AND timestamp::DATE BETWEEN '${startDate}' AND '${endDate}'`;
    }

    return baseQuery;
  };

  const handleTabChange = (index: number) => {
    setActiveTab(index);
    setLoadedTabs(prev => new Set([...prev, index]));
  };

  const handleDateRangeChange = (dateFilter: any) => {
    // Reset all filters
    setSeverityFilter({
      severity: null,
      section: null,
      interlockName: null
    });

    setTitleFilter({
      id: null,
      title: null,
      bu: 'LPG',
      alert_section: null,
      tt_type: null
    });
    setTtTypeFilter(null);

    setDateRangeFilter(dateFilter);
    setTimeFilter(null);
  };

  const handleLocationChange = (locationId: string, zone?: string) => {
    setLocationFilter((prev) => ({
      ...prev,
      plant: locationId,
      zone: zone,
    }))
  }
  const [resetTrigger, setResetTrigger] = useState(0);
  // Modify your handleRefresh function to properly reset location filters
  const handleRefresh = () => {
    setIsLoading(true);

    // Reset location filter state
    setLocationFilter({
      zone: null,
      plant: null,
    });

    // Reset alertSection state
    // setAlertSection(null);

    // Reset other filters
    setSeverityFilter({
      severity: null,
      section: null,
      interlockName: null,
      // bu: "TAS",
    });
    setAlertSection(null);
    setTtTypeFilter(null);
    setTitleFilter({
      id: null,
      title: null,
      bu: "LPG",
      alert_section: null,
      tt_type: null,
    });

    setTimeFilter("t");
    setDateRangeFilter(null);

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
                <BreadcrumbPage className="text-gray-900">LPG Home</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex items-center gap-4">
            {/* <AlertStatusToggle status={alertStatus} onToggle={toggleAlertStatus} /> */}

            <ZonePlantSelections
              key={`zone-plant-${resetTrigger}`} // Add this key
              bu="LPG"
              zone={locationFilter.zone}
              sapid={locationFilter.plant}
              onZoneChange={(zoneId) => handleLocationChange(null, zoneId)}
              onPlantChange={handlePlantChange}
              hideAlertType={true}
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

        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 p-1">
          {!sapId && (
            <>
              <div className="grid  md:grid-cols-1 lg:grid-cols-2 grid-cols-2 gap-2">
                <Projects
                  key={`pq-${resetTrigger}`}
                  units={businessUnits}
                  title="PQ"
                  preventTitleNavigation
                  onSeverityFilter={(severity, interlockName) =>
                    handleSeverityFilter(severity, interlockName, 'LPG')}
                  onTitleClick={(id, title) => handleTitleClick(id, title, 'LPG', 'LPG')}
                  showAdditionalCards={false}
                  timeFilter={timeFilter || dateRangeFilter}
                  locationFilter={locationFilter}
                  alertStatus={alertStatus}
                />
                <Projects
                  key={`va-${resetTrigger}`}
                  units={businessUnits1}
                  title="VA"
                  preventTitleNavigation
                  onSeverityFilter={(severity, interlockName) =>
                    handleSeverityFilter(severity, interlockName, 'VA')}
                  onTitleClick={(id, title) => handleTitleClick(id, title, 'LPG', 'VA')}
                  showAdditionalCards={false}
                  timeFilter={timeFilter || dateRangeFilter}
                  locationFilter={locationFilter}
                  alertStatus={alertStatus}
                  resetTrigger={resetTrigger}
                />
              </div>
              <div className="ml-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-2">
                <Projects
                  key={`vts-bulk-${resetTrigger}`}
                  units={businessUnits2VtsBulk}
                  title="VTS Bulk"
                  ttType="bulk"
                  distributionSectionTitle="Alert Distribution"
                  topAlertsSectionTitle="Top Alerts"
                  preventTitleNavigation
                  onSeverityFilter={(severity, interlockName) =>
                    handleSeverityFilter(severity, interlockName, 'VTS', 'bulk')}
                  onTitleClick={(id, title) => handleTitleClick(id, title, 'LPG', 'VTS', 'bulk')}
                  showAdditionalCards={false}
                  timeFilter={timeFilter || dateRangeFilter}
                  locationFilter={locationFilter}
                  alertStatus={alertStatus}
                  resetTrigger={resetTrigger}
                />
                <Projects
                  key={`vts-packed-${resetTrigger}`}
                  units={businessUnits2VtsPacked}
                  title="VTS Packed"
                  ttType="packed"
                  distributionSectionTitle="Alert Distribution"
                  topAlertsSectionTitle="Top Alerts"
                  preventTitleNavigation
                  onSeverityFilter={(severity, interlockName) =>
                    handleSeverityFilter(severity, interlockName, 'VTS', 'packed')}
                  onTitleClick={(id, title) => handleTitleClick(id, title, 'LPG', 'VTS', 'packed')}
                  showAdditionalCards={false}
                  timeFilter={timeFilter || dateRangeFilter}
                  locationFilter={locationFilter}
                  alertStatus={alertStatus}
                  resetTrigger={resetTrigger}
                />

                {/* Row 1: 3 charts side by side — spans full 2-col grid width */}
                <div className="col-span-2 grid grid-cols-3 gap-2">
                  {[
                    <StackedBarChart
                      bu="LPG"
                      alert_section={titleFilter.alert_section || undefined}
                      timeFilter={timeFilter || dateRangeFilter}
                      locationFilter={locationFilter}
                      alertStatus={alertStatus}
                    />,
                    <HorizontalStackedBarChart
                      bu="LPG"
                      timeFilter={timeFilter || dateRangeFilter}
                      locationFilter={locationFilter}
                      alertStatus={alertStatus}
                    />,
                    <HourlyBarChart
                      bu="LPG"
                      alertStatus={alertStatus}
                    />,
                  ].map((chart, index) => (
                    <div key={index} className="rounded-md p-1.5 border border-gray-200 text-[10px] bg-white shadow">
                      {chart}
                    </div>
                  ))}
                </div>

                {/* Row 2: AmGaugeChart + InterlockStackedBarChart side by side */}
                <div className="col-span-2 grid grid-cols-2 gap-2">
                  {[
                    <AmGaugeChart
                      bu="LPG"
                      locationFilter={locationFilter}
                      timeFilter={timeFilter}
                      dateRangeFilter={dateRangeFilter}
                    />,
                    <InterlockStackedBarChart
                      bu="LPG"
                      timeFilter={timeFilter || dateRangeFilter}
                      locationFilter={locationFilter}
                    />,
                  ].map((chart, index) => (
                    <div key={index} className="rounded-md p-1.5 border border-gray-200 text-[10px] bg-white shadow">
                      {chart}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div ref={tableRef} className="rounded-md border border-gray-200 text-sm bg-white shadow">
            <Tabs
              variant="unstyled"
              className="w-full"
              index={activeTab}
              onChange={handleTabChange}
            >
              <TabList className="flex border-b">
                {['My Inbox', 'Open Alerts', 'Escalation Alerts', 'Closed Alerts', 'Performance Score'].map((tabName, index) => (
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
                    <ROAlertsTable
                      query={getQuery('Open', 0)}
                      onLocationChange={handleLocationChange}
                      alertSection={alertSection}
                      key={`open-${severityFilter.severity}-${severityFilter.section}-${titleFilter.bu}-${titleFilter.alert_section}-${titleFilter.tt_type ?? ""}-${ttTypeFilter ?? ""}`}
                    />
                  )}
                </TabPanel>
                <TabPanel>
                  {loadedTabs.has(1) && (
                    <ROAlertsTableV2
                      query={getQuery('Open', 1)}
                      onLocationChange={handleLocationChange}
                      alertSection={alertSection}
                      fieldsFor="LPG"
                      isOpenAlertsTab={true}
                      showAssignmentColumns={true}
                      key={`open-${severityFilter.severity}-${severityFilter.section}-${titleFilter.bu}-${titleFilter.alert_section}-${titleFilter.tt_type ?? ""}-${ttTypeFilter ?? ""}`}
                    />
                  )}
                </TabPanel>
                <TabPanel>
                  {loadedTabs.has(2) && (
                    <ROAlertsTableV2
                      query={getQuery('Open', 2)}
                      onLocationChange={handleLocationChange}
                      alertSection={alertSection}
                      fieldsFor="LPG"
                      isOpenAlertsTab={false}
                      key={`open-${severityFilter.severity}-${severityFilter.section}-${titleFilter.bu}-${titleFilter.alert_section}-${titleFilter.tt_type ?? ""}-${ttTypeFilter ?? ""}`}
                    />
                  )}
                </TabPanel>
                <TabPanel>
                  {loadedTabs.has(3) && (
                    <AlertsTableClosedTab
                      query={getQuery('Close', 3)}
                      onLocationChange={handleLocationChange}
                      hiddenColumns={['assigned_user_roles', 'last_escalated_to']}
                      alertSection={alertSection}
                      fieldsFor="LPG"
                      showAssignmentColumns={true}
                      ttType={titleFilter.alert_section === 'VTS' && titleFilter.tt_type ? titleFilter.tt_type : (severityFilter.section === 'VTS' && ttTypeFilter ? ttTypeFilter : null)}
                      key={`closed-${severityFilter.severity}-${severityFilter.section}-${titleFilter.bu}-${titleFilter.alert_section}-${titleFilter.tt_type ?? ""}-${ttTypeFilter ?? ""}`}
                    />
                  )}
                </TabPanel>

                <TabPanel>
                  {loadedTabs.has(4) && (
                    <PerformanceScoreTable
                      query={PerformanceQuery(4)}
                      timeFilter={timeFilter}
                      dateRangeFilter={dateRangeFilter}
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

export default LPGHome;