import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import store from './redux/store';
import AuthProvider from '@/providers/authProvider';
import MainLayout from './components/layout/MainLayout';
import "@xyflow/react/dist/style.css";
import { GlobalStoreProvider } from './store/VisibilityProvider';
import { DryoutProvider } from './providers/DryoutProvider';

//Import LoginPage and PageWrapper early to ensure fast initial auth check
import LoginPage from './pages/login/LoginPage';
import PageWrapper from './components/layout/PageWrapper';

// Lazy loaded components (non-critical for initial load)
const Wall = lazy(() => import('./pages/component/Wall2/CriticalAlerts'));

// Route configurations
import {  //
  dashboardRoutes,
  assetRoutes,
  configurationRoutes,
  retailTerminalRoutes,
  dncRoutes,
  lpgRoutes,
  mastersRoutes,
  consumerPumpRoutes,
  // actionCenterRoutes,
  monitoringRoutes,
  otherRoutes,
  sodTerminalRoutes,
  supplyChainRoutes,
  vaRoutes,
  directsales,
  vtsRoutes,
  salesPerformanceRoutes,
  emlockRoutes,
  aiRoutes,
  settingsRoutes,
  auditlog,
  industryPerformanceRoutes,
  governanceRoutes,
  Ticketig,
  cemsRoutes,
  pipelineRoutes,
  naturalGasRoutes,
} from './routes'; // Create this file to organize routes

import ProtectedRoute from './store/protectedRoute';
import ApiLoader from './services/apiLoader';
import NotFoundPage from './pages/home/NotFound';
import LocationDetails from './pages/component/alertsTable/LocationDetails';
import AuthCallback from './pages/login/AuthCallback';
import LogoutCallback from './pages/login/LogoutCallback';

const LoadingSpinner = () => (
  <div>
    <ApiLoader loading={true} />
  </div>
);

function App() {
  return (
    <Provider store={store}>
      <GlobalStoreProvider>
        <DryoutProvider>
          <BrowserRouter>
            <AuthProvider>
              <Suspense fallback={<LoadingSpinner />}>
                <Routes>
                  {/* Public Routes */}
                  <Route
                    path="/"
                    element={
                      <PageWrapper state="login">
                        <LoginPage />
                      </PageWrapper>
                    }
                  />
                  {/* SSO Callback Route */}
                  <Route
                    path="/login/callback"
                    element={
                      <AuthCallback />
                    }
                  />
                  {/* Logout Callback Route */}
                  <Route
                    path="/logout/callback"
                    element={
                      <LogoutCallback />
                    }
                  />

                  {/* Semi-Protected Routes (need special handling) */}
                  <Route
                    path="/dnc/home/wall"
                    element={
                      <PageWrapper state="wall">
                        <Wall />
                      </PageWrapper>
                    }
                  />

                  {/* Protected Routes */}
                  <Route element={<ProtectedRoute />}>
                    <Route element={<MainLayout />}>
                      {/* Industry performance */}
                      {industryPerformanceRoutes}

                      {/* Sales Performance Routes */}
                      {salesPerformanceRoutes}

                      {/* Dashboard Routes */}
                      {dashboardRoutes}

                      {/* Asset Routes */}
                      {assetRoutes}

                      {/* Configuration Routes */}
                      {configurationRoutes}

                      {/* SupplyChain Routes  */}
                      {supplyChainRoutes}

                      {/* SOD Terminal Routes */}
                      {sodTerminalRoutes}

                      {/* Retail Terminal Routes */}
                      {retailTerminalRoutes}

                      {/* LPG Routes  */}
                      {lpgRoutes}

                      {/* Consumer Pump Routes */}
                      {consumerPumpRoutes}

                      {/* Video Analytics Routes */}
                      {vaRoutes}
                      {/* Direct Sales Routes */}
                      {directsales}

                      {/* CEMS Routes */}
                      {cemsRoutes}

                      {/* Pipeline Routes */}
                      {pipelineRoutes}

                      {/* Natural Gas */}
                      {naturalGasRoutes}

                      {/* Vehicle Tracking System Routes */}
                      {vtsRoutes}

                      {/* Governance Routes */}
                      {governanceRoutes}

                      {/* EMLOCK Routes */}
                      {emlockRoutes}

                      {Ticketig}
                      {/* Roles & Users location */}
                      {settingsRoutes}
                      {auditlog}

                      {/* DNC Routes */}
                      {dncRoutes}

                      {/* LPG Routes */}
                      {lpgRoutes}

                      {/* Masters Routes */}
                      {mastersRoutes}

                      {/* Consumer Pump Routes */}
                      {consumerPumpRoutes}

                      {/* Action Center Routes */}
                      {/* {actionCenterRoutes} */}

                      {/* Monitoring Routes */}
                      {monitoringRoutes}

                      {otherRoutes}

                      {aiRoutes}

                      <Route
                        path="/location/:sapId"
                        element={
                          <PageWrapper state="location.sapId">
                            <LocationDetails />
                          </PageWrapper>
                        }
                      />

                      {/* 404 Route */}
                      <Route path="*" element={<NotFoundPage />} />
                    </Route>
                  </Route>
                </Routes>
              </Suspense>
            </AuthProvider>
          </BrowserRouter>
        </DryoutProvider>
      </GlobalStoreProvider>
    </Provider>
  );
}

export default App;
