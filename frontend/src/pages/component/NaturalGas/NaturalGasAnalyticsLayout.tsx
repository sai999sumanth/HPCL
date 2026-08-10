import React from "react";
import { Outlet } from "react-router-dom";
import { NaturalGasAnalyticsChrome } from "./NaturalGasAnalyticsChrome";
import { NaturalGasAnalyticsDateProvider } from "./NaturalGasAnalyticsDateContext";

/** Analytics child routes: shared date filters + sticky tab header, then outlet. */
export const NaturalGasAnalyticsLayout: React.FC = () => (
  <NaturalGasAnalyticsDateProvider>
    <NaturalGasAnalyticsChrome>
      <Outlet />
    </NaturalGasAnalyticsChrome>
  </NaturalGasAnalyticsDateProvider>
);
