

// import React, { useState, useEffect } from 'react';
// import { Card, CardContent } from "../../../@/components/ui/card";
// import { Button } from '../../../@/components/ui/button';
// import { ROAlertsTable } from '../alertsTable/ROAlertsTable';
// import { useNavigate, useParams } from 'react-router-dom';
// import { Tabs, TabList, TabPanels, Tab, TabPanel } from '@chakra-ui/react';
// import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/@/components/ui/breadcrumb';



// const LocationDetails: React.FC = () => {
//   const navigate = useNavigate();
//   const { sapId } = useParams<{ sapId: string }>();
//   const [activeTab, setActiveTab] = useState(0);
//   const [loadedTabs, setLoadedTabs] = useState<Set<number>>(new Set([0]));


//   const handleBackToHome = () => {
//     navigate(-1);
//   };

//   const handleTabChange = (index: number) => {
//     setActiveTab(index);
//     setLoadedTabs((prev) => new Set([...prev, index]));
//   };

//   // if (isLoading) {
//   //   return (
//   //     <div className="p-4 flex justify-center items-center">
//   //       <div>Loading location details...</div>
//   //     </div>
//   //   );
//   // }

//   if (!location) {
//     return (
//       <div className="p-4">
//         <Card>
//           <CardContent className="p-4">
//             <div className="text-center">
//               <h2 className="text-lg font-semibold text-red-600">Location not found</h2>
//               <Button variant="outline" onClick={handleBackToHome} className="mt-4">
//                 Back
//               </Button>
//             </div>
//           </CardContent>
//         </Card>
//       </div>
//     );
//   }

//   return (
//     <div >
//       <Card className="w-full">
//         <CardContent className="p-2">
//           {/* <div className="flex items-center justify-between mb-1">
//             <Button variant="outline" onClick={handleBackToHome}>
//               Back 
//             </Button>
//           </div> */}
//           <Breadcrumb className="px-3 py-2">
//           <BreadcrumbList>
//             <BreadcrumbItem className="hidden md:block cursor-pointer">
//               <BreadcrumbLink onClick={() => navigate(-1)}>
//                 Home
//               </BreadcrumbLink>
//             </BreadcrumbItem>
//             <BreadcrumbSeparator className="hidden md:block" />
//             <BreadcrumbItem>
//               <BreadcrumbPage>Location Details</BreadcrumbPage>
//             </BreadcrumbItem>
//           </BreadcrumbList>
//         </Breadcrumb> 
          
//           <div className="w-full">
//             <div className="rounded-md border border-gray-200 text-sm bg-white shadow">
//               <Tabs
//                 variant="unstyled"
//                 className="w-full"
//                 index={activeTab}
//                 onChange={handleTabChange}
//               >
//                 <TabList className="relative flex border-b">
//                   {['Open Alerts', 'Closed Alerts'].map((tabName, index) => (
//                     <Tab
//                       key={tabName}
//                       className={`relative px-3 py-1.5 text-sm font-medium transition-colors ${
//                         activeTab === index ? 'text-blue-500' : 'text-gray-600'
//                       }`}
//                     >
//                       {tabName}
//                       {activeTab === index && (
//                         <span
//                           className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400 rounded-full transition-all duration-300"
//                         />
//                       )}
//                     </Tab>
//                   ))}
//                 </TabList>

//                 <TabPanels className="p-1">
//                   <TabPanel>
//                     {loadedTabs.has(0) && <ROAlertsTable query={`sap_id='${sapId}' AND alert_status!='Close'`} />}
//                   </TabPanel>
//                   <TabPanel>
//                     {loadedTabs.has(1) && <ROAlertsTable query={`sap_id='${sapId}' AND alert_status='Close'`} />}
//                   </TabPanel>
//                 </TabPanels>
//               </Tabs>
//             </div>
//           </div>
//         </CardContent>
//       </Card>
//     </div>
//   );
// };


// export default LocationDetails;

import React, { useState } from 'react';
import { Card, CardContent } from "../../../@/components/ui/card";
import { Button } from '../../../@/components/ui/button';
import { ROAlertsTable } from '../alertsTable/ROAlertsTable';
import { useNavigate, useParams } from 'react-router-dom';
import { Tabs, TabList, TabPanels, Tab, TabPanel } from '@chakra-ui/react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/@/components/ui/breadcrumb';
import TimeFilterButtons from "../RetailOutletHome/TimeFilterButtons";
import ZonePlantSelections from "../RetailOutletHome/ZonePlantSelections";

interface LocationFilter {
  zone: string | null;
  plant: string | null;
}

interface SeverityFilter {
  severity: string | null;
  section: string | null;
  interlockName: string | null;
  bu: string;
}

interface TitleFilter {
  id: number | null;
  title: string | null;
  bu: string;
  alert_section: string | null;
}

const LocationDetails: React.FC = () => {
  const navigate = useNavigate();
  const { sapId } = useParams<{ sapId: string }>();
  const [activeTab, setActiveTab] = useState(0);
  const [loadedTabs, setLoadedTabs] = useState<Set<number>>(new Set([0]));
  const [timeFilter, setTimeFilter] = useState("t");
  const [dateRangeFilter, setDateRangeFilter] = useState<any>(null);
  const [locationFilter, setLocationFilter] = useState<LocationFilter>({
    zone: null,
    plant: sapId || null
  });

  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>({
    severity: null,
    section: null,
    interlockName: null,
    bu: ""
  });

  const [titleFilter, setTitleFilter] = useState<TitleFilter>({
    id: null,
    title: null,
    bu: "",
    alert_section: null
  });

  const handleZoneChange = (zone: string) => {
    setLocationFilter(prev => ({
      ...prev,
      zone,
      plant: sapId || null
    }));
  };

  const handlePlantChange = (plant: string) => {
    setLocationFilter(prev => ({
      ...prev,
      plant
    }));
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
      section: null,
      interlockName: null,
      bu: "TAS"
    });
    
    setTitleFilter({
      id: null,
      title: null,
      bu: "TAS",
      alert_section: null
    });
    
    setTimeFilter(filterMap[filter] || filter);
  };

  const handleSeverityFilter = (
    severity: string | null,
    interlockName: string | null,
    section: string
  ) => {
    setSeverityFilter({
      severity,
      section,
      interlockName,
      bu: "TAS"
    });

    setTitleFilter({
      id: null,
      title: null,
      bu: "TAS",
      alert_section: section
    });
  };

  const handleTitleClick = (cardId: number, cardTitle: string, bu: string, alert_section: string) => {
    setTitleFilter({
      id: cardId,
      title: cardTitle,
      bu: bu,
      alert_section: alert_section
    });
    
    setSeverityFilter({
      severity: null,
      section: null,
      interlockName: null,
      bu: bu
    });
  };

  const handleDateRangeChange = (dateFilter: any) => {
    setSeverityFilter({
      severity: null,
      section: null,
      interlockName: null,
      bu: "TAS"
    });
    
    setTitleFilter({
      id: null,
      title: null,
      bu: "TAS",
      alert_section: null
    });
    
    setDateRangeFilter(dateFilter);
    setTimeFilter(null);
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

  const getQuery = (baseStatus: string): string => {
    let baseQuery = `sap_id='${sapId}' AND alert_status${baseStatus}`;

    if (locationFilter.zone) {
      baseQuery += ` AND zone='${locationFilter.zone}'`;
    }

    // Add severity filter
    if (severityFilter.severity) {
      baseQuery += ` AND severity='${severityFilter.severity}'`;
    }

    // Add interlock name filter
    if (severityFilter.interlockName) {
      baseQuery += ` AND interlock_name='${severityFilter.interlockName}'`;
    }

    // Add alert section filter from either title or severity filter
    if (titleFilter.alert_section) {
      baseQuery += ` AND alert_section='${titleFilter.alert_section}'`;
    } else if (severityFilter.section) {
      baseQuery += ` AND alert_section='${severityFilter.section}'`;
    }

    // Add time filter
    if (timeFilter) {
      const timeFilterQuery = getTimeFilterQuery(timeFilter);
      if (timeFilterQuery) {
        baseQuery += ` AND ${timeFilterQuery}`;
      }
    } else if (dateRangeFilter) {
      const [startDate, endDate] = dateRangeFilter.value.split(',');
      baseQuery += ` AND created_at::DATE BETWEEN '${startDate}' AND '${endDate}'`;
    }
    
    return baseQuery;
  };

  const handleTabChange = (index: number) => {
    setActiveTab(index);
    setLoadedTabs((prev) => new Set([...prev, index]));
  };

  return (
    <div>
      <Card className="w-full">
        <CardContent className="p-2">
          <div className="flex items-center justify-between px-3 py-2">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block cursor-pointer">
                  <BreadcrumbLink onClick={() => navigate(-1)}>
                    Home
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Location Details</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="flex items-center gap-4">
              <ZonePlantSelections
                bu="TAS"
                onZoneChange={handleZoneChange}
                onPlantChange={handlePlantChange}
              />
              <TimeFilterButtons
                selectedFilter={timeFilter}
                onFilterChange={handleTimeFilterChange}
                onDateRangeChange={handleDateRangeChange}
              />
            </div>
          </div>
          
          <div className="w-full">
            <div className="rounded-md border border-gray-200 text-sm bg-white shadow">
              <Tabs
                variant="unstyled"
                className="w-full"
                index={activeTab}
                onChange={handleTabChange}
              >
                <TabList className="relative flex border-b">
                  {['Open Alerts', 'Closed Alerts'].map((tabName, index) => (
                    <Tab
                      key={tabName}
                      className={`relative px-3 py-1.5 text-sm font-medium transition-colors ${
                        activeTab === index ? 'text-blue-500' : 'text-gray-600'
                      }`}
                    >
                      {tabName}
                      {activeTab === index && (
                        <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400 rounded-full transition-all duration-300" />
                      )}
                    </Tab>
                  ))}
                </TabList>

                <TabPanels className="p-1">
                  <TabPanel>
                    {loadedTabs.has(0) && (
                      <ROAlertsTable 
                        query={getQuery("!='Close'")}
                        key={`open-${timeFilter}-${dateRangeFilter?.value}-${locationFilter.zone}-${locationFilter.plant}-${severityFilter.severity}-${severityFilter.section}-${titleFilter.alert_section}`}
                      />
                    )}
                  </TabPanel>
                  <TabPanel>
                    {loadedTabs.has(1) && (
                      <ROAlertsTable 
                        query={getQuery("='Close'")}
                        key={`closed-${timeFilter}-${dateRangeFilter?.value}-${locationFilter.zone}-${locationFilter.plant}-${severityFilter.severity}-${severityFilter.section}-${titleFilter.alert_section}`}
                      />
                    )}
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LocationDetails;