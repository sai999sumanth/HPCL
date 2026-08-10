import React, { useState } from 'react';
import { Grid } from '@mui/material';
import LPGZonePerformanceChart from './LPGSalesPerformanceChart';
import CumulativeSalesSummary from './CumulativeSalesSummary';
import TotalBookingsorderSource from './TotalBookingsOrderSource';
import OverallPendingPMUYNMPUY from './OverallPending';
import SalesCards from './SalesCards';
import CurrentYearSales from './CurrentYearSales';
import TotalConsumer from './Consumer_Statistics/TotalConsumer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/@/components/ui/tabs';
import OverallSafetyCheckPending from './Consumer_Statistics/OverallSafetyCheckPending';
import TotalSuvidhaClub from './Consumer_Statistics/TotalSuvidhaClub';
import EkycStatisticsChart from './Consumer_Statistics/EkycStatisticsChart';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/@/components/ui/breadcrumb';
import { useNavigate } from 'react-router-dom';
import LPGSalesDashboard from './LPGSalesBigNumberDashboard';
import CarryForwardAnalysis from '../../SupplyChain/DaywiseDryoutChart';
import CTCStatistics from './Consumer_Statistics/OverallCTCStatistics';
import LpgSalesComparisonChart from './LpgSalesComparisonChart';
import OverallAgeingChart from './OverallAgeingChart';
import SubsidyExceptionStats from './Subsidy_Statistics/SubsidyExceptionStats';
import SubsidyFailureStats from './Subsidy_Statistics/SubsidyFailureStats';
import SakhiRegistrationStatistics from './SakhiRegistrationStatistics';
import LPGBacklogChart from './LPGBacklogChart';
import LPGDBCEnrollments from './LPGDBCEnrollments';
import { LPGDateCard, LPGNameCard } from './LPGDateNameCard';
import DomesticSalesTable from './LPGCDCMSPivotTable';
import LPGPccChart from './LPGPccChart';
import LPGncStats from './LPGnewConnections';
import SubsidyCentralconsumers from './Subsidy_Statistics/SubsidyCentralconsumers';
import LPGnewConnections from './LPGnewConnections';
import Subsidycentral_transaction from './Subsidy_Statistics/Subsidycentral_transaction';
import SubsidyTotalamount from './Subsidy_Statistics/SubsidyTotalamount';
import SubsidyStateconsumer from './Subsidy_Statistics/SubsidyStateconsumer';
import SubsidyStatetransaction from './Subsidy_Statistics/SubsidyStatetransaction';
import SubsidyStateamount from './Subsidy_Statistics/SubsidyStateamount';
import GlobalFilter from './Subsidy_Statistics/Globelfilter';
import SubsidyFailureChart from './Subsidy_Statistics/DaywiseFailureStats';
import SubsidyExceptionChart from './Subsidy_Statistics/DaywiseExceptionStats';
import SubsidyStateConsumers from './Subsidy_Statistics/SubisdyStateConsumers';
import SubsidyStackTransaction from './Subsidy_Statistics/SubsidyStackTransaction';
import SubsidyStackAmount from './Subsidy_Statistics/SubsidyStackAmount';
import OverallCTCTrendline from './Consumer_Statistics/OverallCTCTrendline';
import LPGStockDashboard from './LPGMonitoring';
// import Globelfilter from './Subsidy_Statistics/Globelfilter';
// import LPGconsumerDashboard from './LPGconsumerDashboard';

const LPGCDCMS = () => {
  const [currentTab, setCurrentTab] = useState("domestic");
  const navigate = useNavigate();

  const [globalFilters, setGlobalFilters] = useState({
    activeFilters: [],
    crossFilters: []
  });

  // Handler for filter changes
  const handleFiltersChange = (activeFilters: any[], crossFilters: any[]) => {
    setGlobalFilters({ activeFilters, crossFilters });
  };

  return (  
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="bg-white shadow-sm">
        {/* Breadcrumb */}
        {/* Tabs Header */}
        <Tabs
          defaultValue="domestic"
          value={currentTab}
          onValueChange={setCurrentTab}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3  ">
            <TabsTrigger
              value="domestic"
            >
              Domestic Sales
            </TabsTrigger>
            <TabsTrigger
              value="subsidy"
            >
              Subsidy Statistics
            </TabsTrigger>
            <TabsTrigger
              value="consumer"
            >
              Consumer Statistics
            </TabsTrigger>
            {/* <TabsTrigger
              value="monitoring"
            >
              LPG Plant Stock Monitoring
            </TabsTrigger> */}
          </TabsList>

          {/* Tab Content */}
          <TabsContent value="domestic" className="m-0">
            <Grid container spacing={1}>
              {/* <Grid item xs={12}>
                <LPGNameCard />
              </Grid> */}
              <Grid item xs={12}>
                <LPGSalesDashboard />
              </Grid>
             
              <Grid item xs={12} md={4} style={{paddingTop: 0}}>
                <CurrentYearSales />
              </Grid>

              <Grid item xs={12} md={8} style={{paddingTop: 0}}>
                <LpgSalesComparisonChart />
              </Grid>

              <Grid item xs={12} style={{paddingTop: 5}}>
                {/* <LPGDateCard /> */}
                <LPGZonePerformanceChart />
              </Grid>
              <Grid item xs={12} md={6} style={{paddingTop: 5}}>
              <OverallAgeingChart />
                
              </Grid>
              <Grid item xs={12} md={6} style={{paddingTop: 5}}>
                <OverallPendingPMUYNMPUY />
              </Grid>
              <Grid item xs={12} style={{paddingTop: 5}}>
              <TotalBookingsorderSource />
              </Grid>
              <Grid item xs={12}  md={6} style={{paddingTop: 5}}>
                <LPGBacklogChart />
              </Grid>
              <Grid item xs={12}  md={6} style={{paddingTop: 5}}>
               <LPGPccChart/>
              </Grid>
              <Grid item xs={12} style={{paddingTop: 5}}>
                <LPGnewConnections/>
              </Grid>
              <Grid item xs={12}  style={{paddingTop: 5}}>
                <LPGDBCEnrollments />
              </Grid>
              <Grid item xs={12} md={6} style={{paddingTop: 5}}>
                {/* <SakhiRegistrationStatistics /> */}
              </Grid>
             
              {/* <Grid item xs={12} style={{paddingTop: 5}}>
                <LPGBacklogChart />
              </Grid> */}
          
              <Grid item xs={12} style={{paddingTop: 5}}>
                <DomesticSalesTable />
              </Grid>
            </Grid>
          </TabsContent>
          
          <TabsContent value="subsidy" className="m-0">
            <Grid container spacing={1}>
            <Grid item xs={12}  style={{paddingTop: 5}}>
            <GlobalFilter onFiltersChange={handleFiltersChange} />
            </Grid>
            <Grid item xs={12} md={6} style={{paddingTop: 5}}>
            <SubsidyCentralconsumers globalActiveFilters={globalFilters.activeFilters}
        globalCrossFilters={globalFilters.crossFilters}/>
              </Grid>

              <Grid item xs={12} md={6} style={{paddingTop: 5}}>
              <SubsidyStateconsumer globalActiveFilters={globalFilters.activeFilters}
        globalCrossFilters={globalFilters.crossFilters}/>
              </Grid>
              <Grid item xs={12} md={6} style={{paddingTop: 5}}>
              <SubsidyTotalamount globalActiveFilters={globalFilters.activeFilters}
        globalCrossFilters={globalFilters.crossFilters} />
              </Grid>
              <Grid item xs={12} md={6} style={{paddingTop: 5}}>
              <SubsidyStateamount globalActiveFilters={globalFilters.activeFilters}
        globalCrossFilters={globalFilters.crossFilters}/>
            </Grid>

            <Grid item xs={12} md={6} style={{paddingTop: 5}}>
            <Subsidycentral_transaction globalActiveFilters={globalFilters.activeFilters}
        globalCrossFilters={globalFilters.crossFilters}/>
            
            </Grid>
            <Grid item xs={12} md={6} style={{paddingTop: 5}}>
            <SubsidyStatetransaction globalActiveFilters={globalFilters.activeFilters}
        globalCrossFilters={globalFilters.crossFilters}/>
            </Grid>
            
            <Grid item xs={12} style={{paddingTop: 5}}>
            <SubsidyStateConsumers/>
            </Grid>

            <Grid item xs={12} style={{paddingTop: 5}}>
              <SubsidyStackAmount />
            </Grid>

            <Grid item xs={12} style={{paddingTop: 5}}>
              <SubsidyStackTransaction />
            </Grid>

              <Grid item xs={12}>
                <SubsidyExceptionStats />
              </Grid>
              
              <Grid item xs={12} style={{paddingTop: 5}}>
                <SubsidyFailureStats />
              </Grid>
                    
              <Grid item xs={12} style={{paddingTop: 5}}>
                <SubsidyFailureChart />
              </Grid>
              <Grid item xs={12} style={{paddingTop: 5}}>
                <SubsidyExceptionChart />
              </Grid>
              
            </Grid>
            
          </TabsContent>

          <TabsContent value="consumer" className="m-0">
            <Grid container spacing={1}>
            {/* <Grid item xs={12}>
                <LPGconsumerDashboard/>
              </Grid> */}
              <Grid item xs={12}>
                <TotalConsumer />
              </Grid>
              {/* <Grid item xs={12}>
                <OverallSafetyCheckPending />
              </Grid> */}
              <Grid item xs={12}>
                <TotalSuvidhaClub />
              </Grid>
              <Grid item xs={12}>
                <CTCStatistics />
              </Grid>
              <Grid item xs={12}>
                <EkycStatisticsChart />
              </Grid>
              <Grid item xs={12}>
                <OverallCTCTrendline />
              </Grid>
            </Grid>
          </TabsContent>

          {/* <TabsContent value="monitoring"> 
            <LPGStockDashboard />
          </TabsContent> */}

        </Tabs>
      </div>
    </div>
  );
};

export default LPGCDCMS;