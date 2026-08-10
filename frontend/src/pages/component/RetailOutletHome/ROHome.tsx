import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Tabs, TabList, TabPanels, Tab, TabPanel } from '@chakra-ui/react';
import { useParams, useNavigate } from 'react-router-dom';
import Projects from '../../projects/Projects';
import { ROAlertsTable } from '../alertsTable/ROAlertsTable';
import { SeverityProvider } from '../../projects/Projects';
import HorizontalStackedBarChart from '../RetailTerminalHome/HorizontalStackedBarChart';
import StackedBarChart from '../RetailTerminalHome/StackedBarChart';
import HourlyBarChart from '../RetailTerminalHome/HourlyBarChart';
import InterlockStackedBarChart from '../RetailTerminalHome/InterlockStackedBarChart';
import PerformanceScoreCard from '../RetailTerminalHome/PerformanceScoreCard';
import AmGaugeChart from '../Wall2/AmGaugeChart';
import TimeFilterButtons from './TimeFilterButtons';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/@/components/ui/breadcrumb';
import ROAlertsTableV2 from '../alertsTable/AlertTableV2';
import { Button } from "@/@/components/ui/button"
import { RotateCcw, Settings } from "lucide-react"
import AlertsTableClosedTab from '../alertsTable/AlertsTableCloseTab';
import PerformanceScoreTable from '../alertsTable/PerformanceScoreTable';
import { apiClient } from '@/services/apiClient';
import RetailServiceRequestModal from './RetailServiceRequestModal';
import useAuthStore from '@/store/authStore';

interface SeverityFilter {
  severity: string | null;
  section: string | null;
  interlockName: string | null;
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
const ROHome: React.FC = () => {
  const { sapId } = useParams<{ sapId?: string }>();
  const navigate = useNavigate();

  const businessUnits = [{ id: 1, bu: 'RO', alert_section: 'RO' }];
  const businessUnits1 = [{ id: 1, bu: 'RO', alert_section: 'VA' }];
  const businessUnits3 = [{ id: 1, bu: "RO", alert_section: "EMLock" }];

  const [timeFilter, setTimeFilter] = useState('t');
  const [dateRangeFilter, setDateRangeFilter] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(1);
  const [loadedTabs, setLoadedTabs] = useState<Set<number>>(new Set([1]));
  const tableRef = useRef<HTMLDivElement>(null);
  const [alertStatus, setAlertStatus] = useState<string>("Open") // New state for alert status
  const [isLoading, setIsLoading] = useState(false)
  const [isServiceRequestModalOpen, setIsServiceRequestModalOpen] = useState(false);
  const currentUser = useAuthStore.getState().user;
  console.log("currentUser", currentUser.novex_role);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>({
    severity: null,
    section: null,
    interlockName: null
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
  const [alertStatusToggle, setAlertStatusToggle] = useState(true) // true = Open, false = Close

  const toggleAlertStatus = () => {
    setAlertStatus((prev) => (prev === "Open" ? "Close" : "Open"))
  }
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
      bu: 'RO',
      alert_section: null
    });

    setTimeFilter(filterMap[filter] || filter);
  };

  const handleTitleClick = (cardId: number, cardTitle: string, bu: string, alert_section: string) => {
    setTitleFilter({
      id: cardId,
      title: cardTitle,
      bu: bu,
      alert_section: alert_section
    });

    // Reset severity filters when title changes
    setSeverityFilter({
      severity: null,
      section: null,
      interlockName: null
    });

    tableRef.current?.scrollIntoView({
      behavior: 'auto',
      block: 'start'
    });
  };

  const handleSeverityFilter = (severity: string | null, interlockName: string | null, section: string) => {
    setSeverityFilter({
      severity,
      section,
      interlockName
    });

    // Reset title filter when severity filter changes
    setTitleFilter({
      id: null,
      title: null,
      bu: 'RO',
      alert_section: null
    });

    tableRef.current?.scrollIntoView({
      behavior: 'auto',
      block: 'start'
    });
  };

  const getQuery = (baseStatus: string, tabIndex: number): string => {
    // Start with base alert status
    let baseQuery = `alert_status='${baseStatus}'`;

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

    // Handle interlock name condition
    if (severityFilter.interlockName === 'Dry Out Each Indent Wise MainFlow') {
      // If user specifically selected this interlock, include it instead of excluding it
      baseQuery += ` AND interlock_name='${severityFilter.interlockName}'`;
    }
    // else {
    //   // Otherwise, exclude it as per default behavior
    //   baseQuery += ` AND interlock_name!='Dry Out Each Indent Wise MainFlow'`;
    // }

    // Add SAP ID filter if present
    if (sapId) {
      baseQuery += ` AND sap_id='${sapId}'`;
    }

    // Only add alert_section filter when explicitly set through user interactions
    if (titleFilter.alert_section) {
      baseQuery += ` AND bu='${titleFilter.bu}' AND alert_section='${titleFilter.alert_section}'`;
    } else if (severityFilter.section) {
      baseQuery += ` AND bu='RO' AND alert_section='${severityFilter.section}'`;
    } else {
      baseQuery += ` AND bu='RO'`; // Only add bu filter by default
    }

    // Add severity filter if present
    if (severityFilter.severity) {
      baseQuery += ` AND severity='${severityFilter.severity}'`;
    }

    // Add interlock name filter only if it's different from the excluded one
    if (severityFilter.interlockName &&
      severityFilter.interlockName !== 'Dry Out Each Indent Wise MainFlow') {
      baseQuery += ` AND interlock_name='${severityFilter.interlockName}'`;
    }

    if (locationFilter.zone) {
      baseQuery += ` AND zone='${locationFilter.zone}'`;
    }

    if (locationFilter.plant) {
      baseQuery += ` AND sap_id='${locationFilter.plant}'`;
    }

    // Add time/date filters
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

  /** Performance score table uses `timestamp` (same contract as Terminal / SOD home). */
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

  /**
   * Query for Performance Score tab — defaults to `bu='RO'` (Terminal home uses `bu='TAS'`).
   * `tabIndex` only selects My Inbox (0) vs Escalation (2); pass 4 so neither branch applies.
   */
  const PerformanceQuery = (tabIndex: number): string => {
    let baseQuery = '';

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

    if (locationFilter.plant) {
      baseQuery += (baseQuery ? ' AND ' : '') + `sap_id='${locationFilter.plant}'`;
    }

    if (titleFilter.alert_section) {
      baseQuery += (baseQuery ? ' AND ' : '') + `bu='${titleFilter.bu}' AND alert_section='${titleFilter.alert_section}'`;
    } else if (severityFilter.section) {
      baseQuery += (baseQuery ? ' AND ' : '') + `bu='RO' AND alert_section='${severityFilter.section}'`;
    } else {
      baseQuery += (baseQuery ? ' AND ' : '') + `bu='RO'`;
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
    setLoadedTabs((prev) => new Set([...prev, index]));
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
      bu: 'RO',
      alert_section: null
    });

    setDateRangeFilter(dateFilter);
    setTimeFilter(null);
  };

  const handleLocationChange = (locationId: string, zone?: string | null) => {
    setLocationFilter(prev => ({
      ...prev,
      plant: locationId,
      ...(zone !== undefined && zone !== null ? { zone } : {}),
    }));
  };

  const [resetTrigger, setResetTrigger] = useState(0);

  /** Aligns PerformanceScoreCard date payload with Terminal Home (same `get_pi_score` contract). */
  const convertTimeFilterToDateRange = useCallback((tf: string | null) => {
    if (!tf) return null;

    const today = new Date();
    let startDate: Date;

    switch (tf) {
      case '3m':
        startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 3);
        break;
      case '1m':
        startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 1);
        break;
      case '1w':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);
        break;
      case 'y':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 1);
        break;
      case 't':
        startDate = new Date(today);
        break;
      default:
        return null;
    }

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = today.toISOString().split('T')[0];

    return {
      key: 'created_at',
      cond: 'date_range',
      value: tf === 'y' ? `${startDateStr},${startDateStr}` : `${startDateStr},${endDateStr}`,
    };
  }, []);

  const convertedDateRange = useMemo(
    () => convertTimeFilterToDateRange(timeFilter),
    [convertTimeFilterToDateRange, timeFilter]
  );

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

  const handleServiceRequestClick = () => {
    setIsServiceRequestModalOpen(true);
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
                <BreadcrumbPage className="text-gray-900">
                  RO Home
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          {/* <AlertStatusToggle status={alertStatus} onToggle={toggleAlertStatus} /> */}
          <div className="flex items-center gap-4">
            {Array.isArray(currentUser?.novex_role) && currentUser.novex_role.includes("RO Dealer") && (
              <Button
                onClick={handleServiceRequestClick}
                className="h-7 px-3 py-1 text-xs font-medium rounded-lg transition-all bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
              >
                Raise Service Request
              </Button>
            )}
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
            <div className="grid grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-2">
              <Projects
                key={`retail-outlet-${resetTrigger}`} // Add a key that changes when resetTrigger changes
                units={businessUnits}
                title="Retail Outlet"
                onSeverityFilter={(severity, interlockName) =>
                  handleSeverityFilter(severity, interlockName, "RO")
                }
                onTitleClick={(id, title) =>
                  handleTitleClick(id, title, "RO", "RO")
                }
                showAdditionalCards={false}
                timeFilter={timeFilter || dateRangeFilter}
                locationFilter={locationFilter}
                alertStatus={alertStatus}
                resetTrigger={resetTrigger}
              />
              <Projects
                key={`va-${resetTrigger}`} // Add a key that changes when resetTrigger changes
                units={businessUnits1}
                title="VA"
                onSeverityFilter={(severity, interlockName) =>
                  handleSeverityFilter(severity, interlockName, "VA")
                }
                onTitleClick={(id, title) =>
                  handleTitleClick(id, title, "RO", "VA")
                }
                showAdditionalCards={false}
                timeFilter={timeFilter || dateRangeFilter}
                locationFilter={locationFilter}
                alertStatus={alertStatus}
                resetTrigger={resetTrigger}

              />
              {/* <Projects
                units={businessUnits3}
                title="EMLOCK"
                onSeverityFilter={(severity, interlockName) => 
                  handleSeverityFilter(severity, interlockName, 'EMLock')}
                onTitleClick={(id, title) => handleTitleClick(id, title, 'RO', 'EMLock')}
                showAdditionalCards={false}
                timeFilter={timeFilter || dateRangeFilter}
                locationFilter={locationFilter}
                alertStatus={alertStatus}

              /> */}

            </div>
            {/* Row 1: Ageing + AmGauge | Performance Score | Open Alerts Breakup. Row 2: Last 24h Alert Trend | Event Analysis (full width, side by side). */}
            <div className="ml-1 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:items-stretch">
                <div className="flex flex-col gap-2 md:row-span-2 min-h-0">
                  <div className="p-4 rounded-md p-1.5 border border-gray-200 text-[10px] bg-white shadow flex-1 min-h-0">
                    <StackedBarChart
                      bu="RO"
                      alert_section="RO"
                      timeFilter={timeFilter || dateRangeFilter}
                      locationFilter={locationFilter}
                      alertStatus={alertStatus}
                    />
                  </div>
                  <div className="p-4 rounded-md p-1.5 border border-gray-200 text-[10px] bg-white shadow flex-1 min-h-0 flex flex-col">
                    <AmGaugeChart
                      bu="RO"
                      locationFilter={locationFilter}
                      timeFilter={convertedDateRange ? null : timeFilter}
                      dateRangeFilter={convertedDateRange || dateRangeFilter}
                      height={300}
                    />
                  </div>
                </div>

                <div className="p-4 rounded-md p-1.5 border border-gray-200 text-[10px] bg-white shadow md:row-span-2 min-h-0 flex flex-col">
                  <PerformanceScoreCard
                    bu="RO"
                    timeFilter={convertedDateRange ? null : timeFilter}
                    dateRangeFilter={convertedDateRange || dateRangeFilter}
                    height={650}
                    refreshTrigger={resetTrigger}
                    onLocationSelect={handleLocationChange}
                    heading="Performance Score"
                  />
                </div>

                <div className="p-4 rounded-md p-1.5 border border-gray-200 text-[10px] bg-white shadow md:row-span-2 min-h-0 flex flex-col">
                  <HorizontalStackedBarChart
                    bu="RO"
                    timeFilter={timeFilter || dateRangeFilter}
                    locationFilter={locationFilter}
                    height={620}
                    alertStatus={alertStatus}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="p-4 rounded-md p-1.5 border border-gray-200 text-[10px] bg-white shadow min-h-0">
                  <HourlyBarChart bu="RO" alertStatus={alertStatus} />
                </div>
                <div className="p-4 rounded-md p-1.5 border border-gray-200 text-[10px] bg-white shadow min-h-0">
                  <InterlockStackedBarChart
                    bu="RO"
                    timeFilter={timeFilter || dateRangeFilter}
                    locationFilter={locationFilter}
                    height={280}
                  />
                </div>
              </div>
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
              {[
                "My Inbox",
                "Open Alerts",
                "Escalation Alerts",
                "Closed Alerts",
                "Performance Score",
              ].map((tabName, index) => (
                <Tab
                  key={tabName}
                  className={`relative px-4 py-2 text-sm font-medium transition-colors ${activeTab === index ? "text-blue-500" : "text-gray-600"
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
                    query={getQuery("Open", 0)}
                    onLocationChange={handleLocationChange}
                    key={`open-${severityFilter.severity}-${severityFilter.section}-${titleFilter.bu}-${titleFilter.alert_section}`}
                    useCreatedAtForCreatedAtColumn={true}
                  />
                )}
              </TabPanel>
              <TabPanel>
                {loadedTabs.has(1) && (
                  <ROAlertsTableV2
                    query={getQuery("Open", 1)}
                    onLocationChange={handleLocationChange}
                    hiddenColumns={['assigned_user_roles', 'last_escalated_to']}
                    fieldsFor="RO"
                    isOpenAlertsTab={true}
                    key={`open-${severityFilter.severity}-${severityFilter.section}-${titleFilter.bu}-${titleFilter.alert_section}`}
                    useCreatedAtForCreatedAtColumn={true}
                  />
                )}
              </TabPanel>
              <TabPanel>
                {loadedTabs.has(2) && (
                  <ROAlertsTableV2
                    query={getQuery("Open", 2)}
                    onLocationChange={handleLocationChange}
                    fieldsFor="RO"
                    isOpenAlertsTab={false}
                    key={`open-${severityFilter.severity}-${severityFilter.section}-${titleFilter.bu}-${titleFilter.alert_section}`}
                    useCreatedAtForCreatedAtColumn={true}
                  />
                )}
              </TabPanel>
              <TabPanel>
                {loadedTabs.has(3) && (
                  <AlertsTableClosedTab
                    query={getQuery("Close", 3)}
                    hiddenColumns={['assigned_user_roles', 'last_escalated_to']}
                    onLocationChange={handleLocationChange}
                    key={`closed-${severityFilter.severity}-${severityFilter.section}-${titleFilter.bu}-${titleFilter.alert_section}`}
                    useCreatedAtForCreatedAtColumn={true}
                  />
                )}
              </TabPanel>
              <TabPanel>
                {loadedTabs.has(4) && (
                  <PerformanceScoreTable
                    query={PerformanceQuery(4)}
                    timeFilter={timeFilter}
                    dateRangeFilter={dateRangeFilter}
                    hiddenColumns={['region']}
                  />
                )}
              </TabPanel>
            </TabPanels>
          </Tabs>
        </div>

        </div>

        <RetailServiceRequestModal
          isOpen={isServiceRequestModalOpen}
          onClose={() => setIsServiceRequestModalOpen(false)}
        />
      </SeverityProvider>
    </div>
  );
};

export default ROHome;
