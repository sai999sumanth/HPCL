import React, { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';
import { View } from "../pages/assets/view/View";
import { Volumes } from "../pages/assets/volumes/Volumes";
import { LocationMaster } from "../pages/component/masters/location/LocationMaster";
import { RoleMaster } from "../pages/component/masters/role/RoleMasters";
import { AssetMaster } from "../pages/component/masters/asset/assetMasters";
import VAHome from '../pages/component/VA/VAHome';
import SODDashboard from '../pages/component/RetailTerminalHome/SODDashboard';
import Analytics from '../pages/component/RetailTerminalHome/TASAnalytics';
import RODashboard from '../pages/component/RetailOutletHome/RODashboard';
import RetailGovernance from '../pages/component/RetailOutletHome/Sanitation Compliance/RetailGovernance';
import SODSupplyChain from '../pages/component/RetailTerminalHome/SODSupplyChain';
import SupplyDashboard from '../pages/component/alertsTable/dashboard-component';
import LPGHome from '../pages/component/LPG/Sales/LPGHome';
import CpHomeComponent from '../pages/component/consumer-pump/cpHomeComponent';
import SODSupplyChainComponent from '../pages/component/RetailTerminalHome/alerts/SODSupplyChain';
import RetailSupplyChainComponent from '../pages/component/RetailOutletHome/RetailSupplyChain';
import PageWrapper from '@/components/layout/PageWrapper';
import TASVideoAnalyticsDashboard from '@/pages/component/RetailTerminal/TASVideoAnalytics';
import LPGVideoAnalyticsDashboard from '@/pages/component/RetailTerminal/LPGVideoAnalytics';
import VAAnalytics from '../pages/component/RetailTerminal/VAAnalytics';
import SalesPerformanceComponent from '@/pages/component/Wall2/SalesPerformance';
import LPGOperations from '@/pages/component/LPG/Plant/LPGOperations/LPGOperations';
import PerformanceInsightsComponent from '@/pages/component/Wall2/PerformanceInsights/PerformanceInsights';
import IndustryPerformanceDashboard from '@/pages/component/Wall2/IndustrialPerformance/IndustryPerformanceDashboard';
import SalesPerformanceLatest from '@/pages/component/Wall2/SalesPerformanceLatest';
import EMLOCKHome from '@/pages/component/EMLOCKHome/EMLOCKHome';
import AiContainer from '@/pages/ai/AiContainer';
import LocationsManagement from '@/pages/component/settings/Locations/LocationsManagement';
import DirectSalesInsight from '@/pages/component/directSales/directSalesInsight';
import { SbuWiseIndustryPerformance } from '@/pages/component/Wall2/IndustrialPerformance/sbu-wise-industry/SbuWiseIndustryPerformance';
import ROEscalationMatrix from '@/pages/component/settings/ROEscMatrix/ROEscalationMatrix';
import SalesPerformanceTable from '@/pages/component/Wall2/PerformanceInsights/topRetail/SalesPerformanceTable';
import LubesSalesPerformancePage from '@/pages/component/Wall2/PerformanceInsights/sbu-wise-performance/LubesSalesPerformancePage';
import LubesPage from '@/pages/component/Wall2/PerformanceInsights/sbu-wise-performance/LubesPage';
// import LPGDashboard from '@/pages/component/LPG/Sales/LPG/LPGDashboard';
import LoginAudit from '@/pages/component/auditLog/loginAudit';
import LPGDashboard from '@/pages/component/LPG/Sales/LPG/LPGDashboard';
import LPGCarousels from '@/pages/component/LPG/Carousels/LPGCarousels';
import LPGSupplyChain from '@/pages/component/LPG/SupplyChain/LPGSupplyChain';
import NaturalGasNgcmisLayout from '@/pages/component/NaturalGas/NaturalGasNgcmisLayout';
import { NaturalGasAnalyticsLayout } from '@/pages/component/NaturalGas/NaturalGasAnalyticsLayout';
import { ExecutiveSummaryDashboard } from '@/pages/component/NaturalGas/dashboards/ExecutiveSummaryDashboard';
import { MultilevelAnalyticsPage } from '@/pages/component/NaturalGas/dashboards/MultilevelAnalyticsPage';
import { DailyPerformancePage } from '@/pages/component/NaturalGas/dashboards/DailyPerformancePage';
import { NaturalGasMisReports } from '@/pages/component/NaturalGas/NaturalGasMisReports';
import AlertManagerDashboard from '@/pages/component/VTS/AlertsManager/pages/AlertManagerDashboard';
import Ticketing2Screen from '@/pages/component/Ticketing2/Ticketing2Screen';
import TicketsTable from '@/pages/component/Ticketing2/components/TicketsTable';
import { TicketFormPage } from '@/pages/component/Ticketing/components/pages/ticket-form-page';
import { TicketDetailsPage } from '@/pages/component/Ticketing/components/pages/ticket-details-page';
import { TicketFormPage as TicketFormPage2 } from '@/pages/component/Ticketing2/components/pages/ticket-form-page';
import { TicketDetailsPage as TicketDetailsPage2 } from '@/pages/component/Ticketing2/components/pages/ticket-details-page';
import VTSanalyDashboard from '@/pages/component/Governance/VTS Analytics/VTSanalyDashboard';
import VTSInsightDash from '@/pages/component/Governance/VTS Insight/VTSInsightDash';
import VTSViolationHome from '@/pages/component/VTS/VTSViolationHome';
import { VTSLiveDash } from '@/pages/component/Governance/VTS Live/VTSLiveDash';
import CompliancePage from '@/pages/component/Governance/VTS Analytics/CompliancePage';
import  RiskScoreDash  from '@/pages/component/Governance/RiskScore/RiskScoreDash';
import AdminModuleDash from '@/pages/component/Governance/filters/AdminModule/AdminModuleDash';
import RolesManagement from '@/pages/component/settings/Users/UsersManagement';
import Roles from '@/pages/component/settings/Roles/roles';
import TASSupplyChainComponent from '@/pages/component/RetailTerminalHome/TASGovernance/TASSupplyChain/TASSupplyChain';

// import WatchLiveDash from '@/pages/component/Governance/WatchLive/WatchLiveDash';
// Lazy loaded components
const HomePage = lazy(() => import('../pages/home/HomePage'));
// const Projects = lazy(() => import('../pages/projects/Projects'));
import DirectSalesSupplyChain from '../pages/component/directSales/directSalesSupplyChain';
import AIQueryPage from '@/pages/component/VTS/AIQueryPage/AIQueryPage';
import CEMSDashboard from '@/pages/component/CEMS/components/CEMSDashboard';
import { DeviceCommisisoningDash } from '../pages/component/VTS/DeviceManager/DeviceCommisisoningDash';
import TASAnalytics from '../pages/component/RetailTerminalHome/TASAnalytics';
import KPIDashboard from '@/pages/component/Wall2/KPIDashboards/KPIDashboard';
import RetailOutletStockoutsDashboard from '@/pages/component/Wall2/KPIDashboards/RetailOutletStockoutsDashboard';
import ConsolidatedPlantReport from '@/pages/component/LPG/ConsolidatedReport/ConsolidatedReport';
import LPGPlantwiseReport from '@/pages/component/LPG/ConsolidatedReport';
import SystumAudit from '@/pages/component/auditLog/systemAudit';
import SystemAudit from '@/pages/component/auditLog/systemAudit';
const ChangelogPage = lazy(() => import('../pages/changelog/ChangelogPage'));
const MultiScreen = lazy(() => import('../pages/component/DNC/MultiScreen'));
const MasterData = lazy(() => import('../pages/component/masterdata/MasterData'));
const CredManagement = lazy(() => import('../pages/component/cv2/CredManagement'));
const JobsTable = lazy(() => import('../pages/component/jobs/JobsPage'));
const TerminalHome = lazy(() => import('../pages/component/RetailTerminalHome/TerminalHome'));
const TerminalAutomation = lazy(() => import('../pages/component/RetailTerminalHome/TerminalAutomation'));
const DNCDashboard = lazy(() => import('../pages/component/DNC/DncDashboard'));
const VideoAnalytics = lazy(() => import('../pages/component/RetailTerminal/VideoAnalytics'));
const VTSHome = lazy(() => import('../pages/component/VTS/VTSHome'));
const Wall = lazy(() => import('../pages/component/Wall2/CriticalAlerts'));
const PipelineMap = lazy(() => import('../pages/component/Wall2/PipelineMap'));
const PipelineMapView = lazy(() => import('../pages/component/Pipeline/PipelineMapView'));
const MkinfraIndiaMap = lazy(() => import('../pages/component/Wall2/MkinfraIndiaMap'));
const DryoutDashboard = lazy(() => import('../pages/component/SupplyChain/DryoutCarryForwardAnalysis'));
const LPGCDCMS = lazy(() => import('../pages/component/LPG/Sales/LPGCDCMS'));
const CDCEMSComponent = lazy(() => import('../pages/component/LPG/CDCEMS/CDCEMS'));
const LPGPlantComponent = lazy(() => import('../pages/component/LPG/Plant/LPGPlant'));
const LPGSalesComponent = lazy(() => import('../pages/component/LPG/Sales/LPGSales'));
const SupplyChainDashboard = lazy(() => import('../pages/component/SupplyChain/SupplyChainDashboard'));
const LocationDetails = lazy(() => import('../pages/component/alertsTable/LocationDetails'));
const ROHome = lazy(() => import('../pages/component/RetailOutletHome/ROHome'));
const DashboardSelector = lazy(() => import('../pages/monitering/MonitoringPage'));
const PerformancePage = lazy(() => import('../pages/home/PerformancePage'));
const Operations = lazy(() => import('../pages/home/Operations'));
const CustomDashboard = lazy(() => import('../pages/custom-dashboard'));
const AlertPage = lazy(() => import('../pages/component/AlertPage'));
const NotFound = lazy(() => import('../pages/home/NotFound'));
const DashboardPage = lazy(() => import('../pages/dashboard/ActionCenter/Dashboard/DashboardsTable'));
const AddDashboard = lazy(() => import('../pages/dashboard/ActionCenter/Dashboard/AddDashbaord'));
const AskAIChartsPage = lazy(() => import('../pages/dashboard/ActionCenter/_Chart/AskAIChartsPage.tsx'));
const DashboardLayout = lazy(() => import('../pages/dashboard/ActionCenter/Dashboard/DashboardLayout'));
const MonitoringPage = lazy(() => import('../pages/monitering/MonitoringPage'));
const LPGStockDashboard = lazy(() => import('../pages/component/LPG/Sales/LPGMonitoring'));
const DynamicSbuWisePerformance = lazy(() => import('../pages/component/Wall2/PerformanceInsights/sbu-wise-performance/DynamicSbuWisePerformance'));
const DynamicSbuWiseSales = lazy(() => import('../pages/component/Wall2/PerformanceInsights/sbu-wise-performance/DynamicSbuWiseSales'));
const SalesMarketingSummary = lazy(() => import('../pages/component/Wall2/PerformanceInsights/SalesMarketingSummary'));const VTSDashboard = lazy(() => import('../pages/component/Governance/VTS/VTSDashboard'));
const TASdash = lazy(() => import('../pages/component/RetailTerminalHome/TASGovernance/TASdash'));
const TASGovernance = lazy(() => import('../pages/component/RetailTerminalHome/TASGovernance/TASGovernance'));
const TASAlerts = lazy(() => import('../pages/component/RetailTerminalHome/TASGovernance/TASAlerts'));
const BayCriticalParameter = lazy(() => import('../pages/component/RetailTerminalHome/TASGovernance/BayCriticalParameter/BayCriticalDashboard'));
const PipelineIframePage = lazy(() => import('../pages/component/Pipeline/PipelineIframePage'));
const PipelineLandingPage = lazy(() => import('../pages/component/Pipeline/PipelineLandingPage'));
const EquipmentHealthCheck = lazy(() => import('../pages/component/RetailTerminalHome/EquipmentHealthCheck/EquipmentHealthCheck'));
const KFactor = lazy(() => import('../pages/component/RetailTerminalHome/TASGovernance/KFactor/KFactor'));

// const DeviceCommisisoningDash = lazy(() => import('../pages/component/VTS/DeviceManager/DeviceCommisisoningDash'));
const EmailsDashboard = lazy(() => import('../pages/component/RetailTerminalHome/TASGovernance/EMAILSDashboard/emailsDashbaord'));
export const industryPerformanceRoutes = (
  <React.Fragment>
    <Route
      path="retail-industry-performance"
      element={
        <PageWrapper state="retail-industry-performance">
          <SbuWiseIndustryPerformance key={"Retail"} sbu={"Retail"} />
        </PageWrapper>
      }
    />
    <Route
      path="lpg-industry-performance"
      element={
        <PageWrapper state="lpg-industry-performance">
          <SbuWiseIndustryPerformance key={"LPG"} sbu={"LPG"} />
        </PageWrapper>
      }
    />
    <Route
      path="i&c-industry-performance"
      element={
        <PageWrapper state="i&c-industry-performance">
          <SbuWiseIndustryPerformance key={"I&C"} sbu={"I&C"} />
        </PageWrapper>
      }
    />
  </React.Fragment>
)
export const dashboardRoutes = (
  <>
    {/* <Route
      path="projects"
      element={
        <PageWrapper state="projects">
          <HomePage />
        </PageWrapper>
      }
    /> */}
    <Route
      path="custom-charts"
      element={
        <PageWrapper state="custom-charts">
          <CustomDashboard />
        </PageWrapper>
      }
    />
    {/* <Route
      path="governance"
      element={
        <PageWrapper state="governance">
          <Projects />
        </PageWrapper>
      }
    /> */}
    <Route
      path="performance"
      element={
        <PageWrapper state="performance">
          <PerformancePage />
        </PageWrapper>
      }
    />
    <Route
      path="kpi-dashboards"
      element={<Navigate to="/kpi-dashboards/lpg" replace />}
    />
    <Route
      path="kpi-dashboards/retail-stockouts"
      element={
        <PageWrapper state="kpi-dashboards-retail-stockouts">
          <RetailOutletStockoutsDashboard />
        </PageWrapper>
      }
    />
  <Route
      path="kpi-dashboards/:bu"
      element={
        <PageWrapper state="kpi-dashboards">
          <KPIDashboard />
        </PageWrapper>
      }
    />
   <Route
      path="marketing-summary"
      element={
        <PageWrapper state="marketing-summary">
          <SalesMarketingSummary />
        </PageWrapper>
      }
    />
    <Route
      path="sales-marketing-summary"
      element={
        <PageWrapper state="sales-marketing-summary">
          <SalesPerformanceLatest />
        </PageWrapper>
      }
    />
    <Route
      path="sales-retail"
      element={
        <PageWrapper state="sales-retail">
          <DynamicSbuWisePerformance key={"Retail"} sbu={"Retail"} />
        </PageWrapper>
      }
    />
    <Route
      path="sales-lpg"
      element={
        <PageWrapper state="sales-lpg">
          <DynamicSbuWisePerformance key={"LPG"} sbu={"LPG"} />
        </PageWrapper>
      }
    />
    <Route
      path="sales-i&c"
      element={
        <PageWrapper state="sales-i&c">
          <DynamicSbuWisePerformance key={"I&C"} sbu={"I&C"} />
        </PageWrapper>
      }
    />
    <Route
      path="sales-lubes"
      element={
        <PageWrapper state="sales-lubes">
          <LubesSalesPerformancePage />
        </PageWrapper>
      }
    />
    <Route
      path="lubes"
      element={
        <PageWrapper state="lubes">
          <LubesPage />
        </PageWrapper>
      }
    />
    <Route
      path="sales-aviation"
      element={
        <PageWrapper state="sales-aviation">
          <DynamicSbuWisePerformance key={"Aviation"} sbu={"Aviation"} />
        </PageWrapper>
      }
    />
    <Route
      path="sales-petchem"
      element={
        <PageWrapper state="sales-petchem">
          <DynamicSbuWisePerformance key={"PETCHEM"} sbu={"PETCHEM"} />
        </PageWrapper>
      }
    />
    <Route
      path="sales-gas"
      element={
        <PageWrapper state="sales-gas">
          <DynamicSbuWisePerformance key={"GAS"} sbu={"GAS"} />
        </PageWrapper>
      }
    />



    <Route
      path="retail-performance"
      element={
        <PageWrapper state="retail-performance">
          <DynamicSbuWiseSales key={"Retail"} sbu={"Retail"} />
        </PageWrapper>
      }
    />
    <Route
      path="lpg-performance"
      element={
        <PageWrapper state="lpg-performance">
          <DynamicSbuWiseSales key={"LPG"} sbu={"LPG"} />
        </PageWrapper>
      }
    />
    <Route
      path="i&c-performance"
      element={
        <PageWrapper state="i&c-performance">
          <DynamicSbuWiseSales key={"I&C"} sbu={"I&C"} />
        </PageWrapper>
      }
    />
    <Route
      path="i&c-Insights-SalesArea-Analytics"
      element={
        <PageWrapper state="i&c-Insights-SalesArea-Analytics">
          <SalesPerformanceTable />
        </PageWrapper>
      }
    />
    <Route
      path="lubes-performance"
      element={
        <PageWrapper state="lubes-performance">
          <DynamicSbuWiseSales key={"Lubes"} sbu={"Lubes"} />
        </PageWrapper>
      }
    />
    <Route
      path="aviation-performance"
      element={
        <PageWrapper state="aviation-performance">
          <DynamicSbuWiseSales key={"Aviation"} sbu={"Aviation"} />
        </PageWrapper>
      }
    />
    <Route
      path="petchem-performance"
      element={
        <PageWrapper state="petchem-performance">
          <DynamicSbuWiseSales key={"PETCHEM"} sbu={"PETCHEM"} />
        </PageWrapper>
      }
    />
    <Route
      path="gas-performance"
      element={
        <PageWrapper state="gas-performance">
          <DynamicSbuWiseSales key={"GAS"} sbu={"GAS"} />
        </PageWrapper>
      }
    />
    <Route
      path="operations"
      element={
        <PageWrapper state="operations">
          <Operations />
        </PageWrapper>
      }
    />
    <Route
      path="DNC"
      element={
        <PageWrapper state="DNC">
          <DNCDashboard />
        </PageWrapper>
      }
    />
  </>
);

export const assetRoutes = (
  <Route path="assets">
    <Route
      path="view"
      element={
        <PageWrapper state="assets.view">
          <View />
        </PageWrapper>
      }
    />
    <Route
      path="volumes"
      element={
        <PageWrapper state="assets.volumes">
          <Volumes />
        </PageWrapper>
      }
    />
  </Route>
);

export const configurationRoutes = (
  <Route path="configuration">
    <Route
      path="master-data"
      element={
        <PageWrapper state="configuration.master-data">
          <MasterData />
        </PageWrapper>
      }
    />
    <Route
      path="vault"
      element={
        <PageWrapper state="configuration.vault">
          <CredManagement />
        </PageWrapper>
      }
    />
    <Route
      path="jobs"
      element={
        <PageWrapper state="configuration.jobs">
          <JobsTable />
        </PageWrapper>
      }
    />
  </Route>
);

export const directsales = (
  <Route path="DirectSales">
    <Route
      path="vtsInsights"
      element={
        <PageWrapper state="DirectSales.vtsInsights">
          <DirectSalesInsight/>
        </PageWrapper>
      }
    />
        <Route
      path="supplyChain"
      element={
        <PageWrapper state="DirectSales.supplyChain">
          <DirectSalesSupplyChain/>
        </PageWrapper>
      }
    />
  </Route>
);
export const cemsRoutes = (
  <Route path="cems">
    <Route
      path="dashboard"
      element={
        <PageWrapper state="cems.dashboard">
          <CEMSDashboard />
        </PageWrapper>
      }
    />
  </Route>
);

export const pipelineRoutes = (
  <Route path="pipeline">
    <Route
      index
      element={
        <PageWrapper state="pipeline">
          <PipelineLandingPage />
        </PageWrapper>
      }
    />
    <Route
      path=":code"
      element={
        <PageWrapper state="pipeline">
          <PipelineIframePage />
        </PageWrapper>
      }
    />
    <Route path="dnc">
      <Route path="home">
        <Route
          path="wall"
          element={
            <PageWrapper state="pipeline.dnc.home.wall">
              <PipelineMapView />
            </PageWrapper>
          }
        />
      </Route>
    </Route>
  </Route>
);
export const vaRoutes = (
  <Route path="VA">
    <Route
      path="VAHome"
      element={
        <PageWrapper state="VA.VAHome">
          <VAHome />
        </PageWrapper>
      }
    />
    <Route
      path="dashboard"
      element={
        <PageWrapper state="VA.dashboard">
          <VideoAnalytics />
        </PageWrapper>
      }
    />
    <Route
      path="VAAnalytics"
      element={
        <PageWrapper state="VA.VAAnalytics">
          <VAAnalytics />
        </PageWrapper>
      }
    />
  </Route>
);

export const vtsRoutes = (
  <Route path="VTS">
    <Route
      path="VTSHome"
      element={
        <PageWrapper state="VTS.VTSHome">
          <VTSHome />

        </PageWrapper>
      }
    />
        <Route
      path="VTSViolationHome"
      element={
        <PageWrapper state="VTS.VTSViolationHome">
          <VTSViolationHome />

        </PageWrapper>
      }
    />
    <Route
      path="AlertManager"
      element={
        <PageWrapper state="VTS.AlertManager">
          <AlertManagerDashboard />

        </PageWrapper>
      }
    />
    <Route
      path="DeviceManager"
      element={
        <PageWrapper state="VTS.DeviceManager">
          <DeviceCommisisoningDash />
        </PageWrapper>
      }
    />
  </Route>
);
export const governanceRoutes = (
  <Route path="governance">
    <Route path="vts">
      <Route
        path="dashboard"
        element={
          <PageWrapper state="governance.vts.dashboard">
            <VTSDashboard />
          </PageWrapper>
        }
      />
      <Route
        path="analytics"
        element={
          <PageWrapper state="governance.vts.analytics">
            <VTSanalyDashboard />
          </PageWrapper>
        }
      />
            <Route
        path="compliance"
        element={
          <PageWrapper state="governance.vts.compliance">
            <CompliancePage/>
          </PageWrapper>
        }
      />
      <Route
        path="insights"
        element={
          <PageWrapper state="governance.vts.insights">
            <VTSInsightDash />
          </PageWrapper>
        }
      />
            <Route
        path="live"
        element={
          <PageWrapper state="governance.vts.live">
            <VTSLiveDash />
          </PageWrapper>
        }
      />
                  <Route
        path="module"
        element={
          <PageWrapper state="governance.vts.module">
            <AdminModuleDash />
          </PageWrapper>
        }
      />
      <Route
        path="score"
        element={
          <PageWrapper state="governance.vts.score">
           <RiskScoreDash />
          </PageWrapper>
        }
      />
      {/* Risk Score cluster map moved to `/dnc/home/mapview` (DNC maps API allowlist) */}
      <Route
        path="score/dnc/home/mapview"
        element={<Navigate to="/dnc/home/mapview" replace />}
      />
      <Route
        path="ai"
        element={
          <PageWrapper state="governance.vts.ai">
           <AIQueryPage />
          </PageWrapper>
        }
      />

    </Route>
    
  </Route>
);
export const emlockRoutes = (
  <Route path="EMLOCK">
    <Route
      path="EMLOCKHome"
      element={
        <PageWrapper state="EMLOCK.EMLOCKHome">
          <EMLOCKHome />
        </PageWrapper>
      }
    />
  </Route>
);
export const retailTerminalRoutes = (
  <Route path="retailOutlet">
    <Route
      path="RO-Home"
      element={
        <PageWrapper state="retailOutlet.RO-Home">
          <ROHome />
        </PageWrapper>
      }
    />
    <Route
      path="SupplyChain"
      element={
        <PageWrapper state="retailOutlet.SupplyChain">
          <RetailSupplyChainComponent />
        </PageWrapper>
      }
    />
    <Route
      path="dashboard"
      element={
        <PageWrapper state="retailOutlet.dashboard">
          <RODashboard />
        </PageWrapper>
      }
    />
    <Route
      path="videoAnalytics"
      element={
        <PageWrapper state="retailOutlet.videoAnalytics">
          <VideoAnalytics />
        </PageWrapper>
      }
    />
    <Route
      path="retailGovernance"
      element={
        <PageWrapper state="retailOutlet.retailGovernance">
          <RetailGovernance />
        </PageWrapper>
      }
    />
     {/* <Route
      path="fieldForce"
      element={
        <PageWrapper state="retailOutlet.fieldForce">
          <FieldForceDashboard />
        </PageWrapper>
      }
    /> */}
  </Route>
  
  
);

export const supplyChainRoutes = (
  <Route path="supplychain">
    <Route
      path="home"
      element={
        <PageWrapper state="supplychain.home">
          <CustomDashboard />
        </PageWrapper>
      }
    />
    <Route
      path="analytics"
      element={
        <PageWrapper state="supplychain.analytics">
          <SupplyChainDashboard />
        </PageWrapper>
      }
    />
    <Route
      path="dryoutAnalysis"
      element={
        <PageWrapper state="supplychain.dryoutAnalysis">
          <DryoutDashboard />
        </PageWrapper>
      }
    />
    <Route
      path="dryout"
      element={
        <PageWrapper state="supplychain.dryout">
          <SupplyDashboard />
        </PageWrapper>
      }
    />
  </Route>
);

export const sodTerminalRoutes = (
  <Route path="sodTerminal">
    <Route
      path="terminalHome"
      element={
        <PageWrapper state="sodTerminal.terminalHome">
          <TerminalHome />
        </PageWrapper>
      }
    />
    <Route
      path="dashboard"
      element={
        <PageWrapper state="sodTerminal.dashboard">
          <SODDashboard />
        </PageWrapper>
      }
    />
    <Route
      path="sodSupplychain"
      element={
        <PageWrapper state="sodTerminal.sodSupplychain">
          <SODSupplyChainComponent />
        </PageWrapper>
      }
    />
    <Route
      path="videoAnalytics"
      element={
        <PageWrapper state="sodTerminal.videoAnalytics">
          <TASVideoAnalyticsDashboard />
        </PageWrapper>
      }
    />

        <Route path="tasGovernance">
              <Route
      path="tasHome"
      element={
        <PageWrapper state="sodTerminal.tasGovernance.tasHome">
          <TASdash />
        </PageWrapper>
      }
    />
      <Route
        path="tasOverview"
        element={
          <PageWrapper state="sodTerminal.tasGovernance.tasOverview">
            <TerminalAutomation />
          </PageWrapper>
        }
      />
      <Route
        path="dashboard"
        element={
          <PageWrapper state="sodTerminal.tasGovernance.dashboard">
            <TASGovernance />
          </PageWrapper>
        }
      />
        <Route

path="TASSupplyChain"

element={

  <PageWrapper state="sodTerminal.tasGovernance.TASSupplyChain">

    <TASSupplyChainComponent />

  </PageWrapper>

}

/>

<Route path="supplyChain" element={<Navigate to="../TASSupplyChain" replace />} />

      <Route path="insights">
        <Route
          path="BCUalerts"
          element={
            <PageWrapper state="sodTerminal.tasGovernance.insights.BCUalerts">
              <TASAlerts />
            </PageWrapper>
          }
        />
        <Route
          path="analytics"
          element={
            <PageWrapper state="sodTerminal.tasGovernance.insights.analytics">
              <TASAnalytics />
            </PageWrapper>
          }
        />
        <Route
          path="bcuCriticalParameter"
          element={
            <PageWrapper state="sodTerminal.tasGovernance.insights.bcuCriticalParameter">
              <BayCriticalParameter />
            </PageWrapper>
          }
        />
      </Route>
      <Route
        path="kFactor"
        element={
          <PageWrapper state="sodTerminal.tasGovernance.kFactor">
            <KFactor />
          </PageWrapper>
        }
      />
     
      <Route
        path="equipmentHealthCheck"
        element={
          <PageWrapper state="sodTerminal.tasGovernance.equipmentHealthCheck">
            <EquipmentHealthCheck />
          </PageWrapper>
        }
      />
    </Route>
  </Route>
  
);

export const dncRoutes = (
  <Route path="dnc">
    <Route
      path="mkt-infra"
      element={
        <PageWrapper state="dnc.mkt-infra">
          <MkinfraIndiaMap />
        </PageWrapper>
      }
    />
    <Route
      path="mi"
      element={
        <PageWrapper state="dnc.mi">
          <PipelineMap />
        </PageWrapper>
      }
    />
    <Route
      path="home"
      element={
        <PageWrapper state="dnc.home">
          <Wall />
        </PageWrapper>
      }
    />
    <Route path="home">
      <Route
        path="mapview"
        element={
          <PageWrapper state="dnc.home.mapview">
            <RiskScoreDash />
          </PageWrapper>
        }
      />
      <Route path="wall">
        <Route
          path="pipeline"
          element={
            <PageWrapper state="dnc.home.wall.pipeline">
              <PipelineMapView />
            </PageWrapper>
          }
        />
      </Route>
    </Route>
    <Route
      path="screens"
      element={
        <PageWrapper state="dnc.screens">
          <MultiScreen />
        </PageWrapper>
      }
    />
  </Route>
);

export const lpgRoutes = (
  <Route path="LPG">
    <Route
      path="Home"
      element={
        <PageWrapper state="LPG.Home">
          <LPGHome />
        </PageWrapper>
      }
    />
    <Route
      path="plantDashboard"
      element={
        <PageWrapper state="LPG.plantDashboard">
          <LPGPlantComponent />
        </PageWrapper>
      }
    />
    <Route
      path="proDash"
      element={
        <PageWrapper state="proDash">
          <LPGDashboard />
        </PageWrapper>
      }
    />
    <Route
      path="settings"
      element={
        <PageWrapper state="LPG.settings">
          <LPGCarousels />
        </PageWrapper>
      }
    />
      <Route
      path="consolidatedReport"
      element={
        <PageWrapper state="LPG.consolidatedReport">
          <LPGPlantwiseReport/>
        </PageWrapper>
      }
    />
    <Route
      path="salesDashboard"
      element={
        <PageWrapper state="LPG.salesDashboard">
          <LPGSalesComponent />
        </PageWrapper>
      }
    />
    <Route
      path="operations"
      element={
        <PageWrapper state="LPG.operations">
          <LPGOperations />
        </PageWrapper>
      }
    />
    <Route
      path="analytics"
      element={
        <PageWrapper state="LPG.analytics">
          <LPGCDCMS />
        </PageWrapper>
      }
    />
    <Route
      path="CDCMS"
      element={
        <PageWrapper state="LPG.CDCMS">
          <CDCEMSComponent />
        </PageWrapper>
      }
    />
    <Route
      path="videoAnalytics"
      element={
        <PageWrapper state="LPG.videoAnalytics">
          <LPGVideoAnalyticsDashboard />
        </PageWrapper>
      }
    />
    <Route
      path="inventory"
      element={
        <PageWrapper state="LPG.inventory">
          <LPGStockDashboard />
        </PageWrapper>
      }
    />
    <Route path="supplyChain">
      <Route index element={<Navigate to="operations" replace />} />
      <Route
        path="operations"
        element={
          <PageWrapper state="LPG.supplyChain.operations">
            <LPGSupplyChain key="lpg-supply-chain-operations" variant="operations" />
          </PageWrapper>
        }
      />
      <Route
        path="sales"
        element={
          <PageWrapper state="LPG.supplyChain.sales">
            <LPGSupplyChain key="lpg-supply-chain-sales" variant="sales" />
          </PageWrapper>
        }
      />
    </Route>
  </Route>
);

export const naturalGasRoutes = (
  <Route path="naturalGas">
    <Route
      path="ngc-mis"
      element={
        <PageWrapper state="naturalGas.ngcMis">
          <NaturalGasNgcmisLayout />
        </PageWrapper>
      }
    >
      <Route index element={<Navigate to="analytics/executive-summary" replace />} />
      <Route path="analytics" element={<NaturalGasAnalyticsLayout />}>
        <Route index element={<Navigate to="executive-summary" replace />} />
        <Route path="executive-summary" element={<ExecutiveSummaryDashboard />} />
        <Route path="multilevel-analytics" element={<MultilevelAnalyticsPage />} />
        <Route path="daily-performance" element={<DailyPerformancePage />} />
      </Route>
      <Route path="mis" element={<NaturalGasMisReports />} />
    </Route>
  </Route>
);

export const mastersRoutes = (
  <Route path="masters">
    <Route
      path="locationMasters"
      element={
        <PageWrapper state="masters.locationMasters">
          <LocationMaster />
        </PageWrapper>
      }
    />
    <Route
      path="roleMasters"
      element={
        <PageWrapper state="masters.roleMasters">
          <RoleMaster />
        </PageWrapper>
      }
    />
    <Route
      path="assetMasters"
      element={
        <PageWrapper state="masters.assetMasters">
          <AssetMaster />
        </PageWrapper>
      }
    />
  </Route>
);

export const consumerPumpRoutes = (
  <Route path="consumerPump">
    <Route
      path="cpHome"
      element={
        <PageWrapper state="consumerPump.cpHome">
          <CpHomeComponent />
        </PageWrapper>
      }
    />
  </Route>
);

export const salesPerformanceRoutes = (
  <Route>
    <Route
      path="salesPerformance"
      element={
        <PageWrapper state="salesPerformance">
          <SalesPerformanceComponent />
        </PageWrapper>
      }
    />
    <Route
      path="industryperformance"
      element={
        <PageWrapper state="industryperformance">
          <IndustryPerformanceDashboard />
        </PageWrapper>
      }
    />
    <Route
      path="Performance"
      element={
        <PageWrapper state="Performance">
          <PerformanceInsightsComponent />
        </PageWrapper>
      }
    />
  </Route>
)

// export const actionCenterRoutes = (
//   <Route path="action-center">
//     <Route
//       path="dashboards"
//       element={
//         <PageWrapper state="action-center.dashboards">
//           <DashboardPage />
//         </PageWrapper>
//       }
//     />
//     <Route
//       path="add-dashboard"
//       element={
//         <PageWrapper state="action-center.dashboards">
//           <AddDashboard isEditMode={true} />
//         </PageWrapper>
//       }
//     />
//     <Route path="dashboard/:id" element={<AddDashboard isEditMode={false} />} />
//     <Route path="dashboard/:id/edit" element={<AddDashboard isEditMode={true} />} />
//     <Route
//       path="charts"
//       element={
//         <PageWrapper state="action-center.charts">
//           <ChartList />
//         </PageWrapper>
//       }
//     />
//     <Route
//       path="choose-chart"
//       element={
//         <PageWrapper state="action-center.charts">
//           <ChartCreate />
//         </PageWrapper>
//       }
//     />
//     <Route
//       path="create-chart"
//       element={
//         <PageWrapper state="action-center.charts">
//           <ChartConfig dataset={""} chartType={""} />
//         </PageWrapper>
//       }
//     />
//     <Route
//       path="ai-chart"
//       element={
//         <PageWrapper state="action-center.charts">
//           <AskAIChartsPage dataset={""} chartType={""} />
//         </PageWrapper>
//       }
//     />
//     <Route path="edit-chart/:id" element={<ChartConfig dataset={""} chartType={""} />} />
//     <Route
//       path="groups"
//       element={
//         <PageWrapper state="action-center.groups">
//           <DashboardLayout />
//         </PageWrapper>
//       }
//     />
//     <Route path="dashboard/:dashboardId" element={<DashboardLayout />} />
//   </Route>
// );

export const monitoringRoutes = (
  <>
    <Route
      path="monitering"
      element={
        <PageWrapper state="monitering">
          <DashboardSelector />
        </PageWrapper>
      }
    />
    <Route
      path="monitoring"
      element={
        <PageWrapper state="monitoring">
          {" "}
          <MonitoringPage />{" "}
        </PageWrapper>
      }
    />
    <Route
      path="monitoring/:groupId"
      element={
        <PageWrapper state="monitoring">
          {" "}
          <MonitoringPage />{" "}
        </PageWrapper>
      }
    />
    <Route
      path="monitoring/:groupId/:dashboardId"
      element={
        <PageWrapper state="monitoring">
          {" "}
          <MonitoringPage />{" "}
        </PageWrapper>
      }
    />
  </>
);

export const otherRoutes = (
  <>
    <Route
      path="changelog"
      element={
        <PageWrapper state="changelog">
          <ChangelogPage />
        </PageWrapper>
      }
    />
    <Route path="/settings/:subRouteName" element={<AlertPage />} />
  </>
)

export const aiRoutes = (
  <Route
    path="novexai"
    element={
      <PageWrapper state="novexai">
        <AiContainer />
      </PageWrapper>
    }
  />
);
export const Ticketig = (
  <>  
    <Route
      path="settings/tickets2"
      element={
        <PageWrapper state="settings.tickets2">
          <Ticketing2Screen />
        </PageWrapper>
      }
    />  
    {/* <Route
      path="settings/tickets"
      element={
        <PageWrapper state="settings.tickets">
          <Ticketing2Screen />
        </PageWrapper>
      }
    /> */}
    <Route
      path="settings/tickets-table"
      element={
        <PageWrapper state="settings.tickets-table">
          <TicketsTable />
        </PageWrapper>
      }
    />
    <Route
      path="settings/add-edit-ticketing"
      element={
        <PageWrapper state="settings.add-edit-ticketing">
          <TicketFormPage />
        </PageWrapper>
      }
    />
    <Route
      path="settings/edit-ticketing/:ticketId"
      element={
        <PageWrapper state="settings/edit-ticketing/:ticketId">
          <TicketFormPage />
        </PageWrapper>
      }
    />
    <Route
      path="ticket/view/:ticketId"
      element={
        <PageWrapper state="ticket/view/:ticketId">
          <TicketDetailsPage />
        </PageWrapper>
      }
    />
    <Route
      path="settings/add-edit-ticketing2"
      element={
        <PageWrapper state="settings.add-edit-ticketing2">
          <TicketFormPage2 />
        </PageWrapper>
      }
    />
    <Route
      path="settings/edit-ticketing2/:ticketId"
      element={
        <PageWrapper state="settings.edit-ticketing2/:ticketId">
          <TicketFormPage2 />
        </PageWrapper>
      }
    />
    <Route
      path="ticket2/view/:ticketId"
      element={
        <PageWrapper state="ticket2/view/:ticketId">
          <TicketDetailsPage2 />
        </PageWrapper>
      }
    />
  </>
);
export const settingsRoutes = ( 
  <>
   <Route
      path="settings/users"
      element={ 
        <PageWrapper state="settings.users">
          <RolesManagement />
        </PageWrapper>
      }
    />    
    <Route
      path="settings/roles"
      element={
        <PageWrapper state="settings.roles">
          <Roles />
        </PageWrapper>
      }
    />
    <Route
      path="settings/locations"
      element={
        <PageWrapper state="settings.locations">
          <LocationsManagement />
        </PageWrapper>
      }
    />
    <Route
      path="settings/ROEscMatrix"
      element={ 
        <PageWrapper state="settings.ROEscMatrix">
          <ROEscalationMatrix />
        </PageWrapper>
      }
    />

    <Route
      path="settings/emails"
      element={
        <PageWrapper state="emails.dashboard">
          <EmailsDashboard />
        </PageWrapper>
      }
    />
      
  </>
);
export const auditlog = (
  <>
    <Route
      path="auditlog/loginAudit"
      element={
        <PageWrapper state="auditlog.loginAudit">
          {/* <ROEscalationMatrix /> */}

          <LoginAudit />
        </PageWrapper>
      }
    />
    <Route
      path="auditlog/systemAudit"
      element={
        <PageWrapper state="auditlog.systemAudit">
          <SystemAudit />
        </PageWrapper>
      }
    />
  </>
)

// {
//   "title": "Ask AI",
//   "icon": "IconCell",
//   "path": "/askai",
//   "type": "item"
// }
