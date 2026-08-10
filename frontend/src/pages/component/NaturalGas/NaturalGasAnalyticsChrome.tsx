import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/@/lib/utils";
import { NaturalGasAnalyticsToolbar } from "./dashboards/NaturalGasSharedFilters";

const tabTriggerClass = (isActive: boolean) =>
  cn(
    "inline-flex min-h-9 items-center justify-center px-2.5 text-xs sm:text-sm rounded-md border-0 transition-colors",
    isActive
      ? "bg-gradient-to-br from-cyan-500 to-blue-600 font-semibold text-white shadow-sm"
      : "bg-slate-100 text-slate-700 shadow-none hover:bg-slate-200/90"
  );

const PATHS = {
  executive: "/naturalGas/ngc-mis/analytics/executive-summary",
  multilevel: "/naturalGas/ngc-mis/analytics/multilevel-analytics",
  daily: "/naturalGas/ngc-mis/analytics/daily-performance",
  distributionMap: "/naturalGas/ngc-mis/analytics/distribution-map",
} as const;

/** Sticky tab strip + date filters (hidden on Multilevel analytics only). */
export const NaturalGasAnalyticsChrome: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  const hideDateFilters = pathname.includes("multilevel-analytics");

  return (
    <>
      <div
        className={cn(
          "sticky top-0 z-[100] mb-2 rounded-lg border border-slate-200/90 bg-white/95 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.12)] backdrop-blur-md supports-[backdrop-filter]:bg-white/90"
        )}
      >
        <div
          className={cn(
            "flex flex-wrap items-center gap-x-2 gap-y-2 p-1.5 sm:gap-3 sm:p-2",
            hideDateFilters && "justify-start"
          )}
        >
          <nav
            className="flex min-h-9 shrink-0 flex-wrap items-center gap-1"
            aria-label="Natural gas analytics sections"
          >
            <NavLink to={PATHS.executive} className={({ isActive }) => tabTriggerClass(isActive)} end>
              Executive summary
            </NavLink>
            <NavLink to={PATHS.multilevel} className={({ isActive }) => tabTriggerClass(isActive)}>
              Multilevel analytics
            </NavLink>
            <NavLink to={PATHS.daily} className={({ isActive }) => tabTriggerClass(isActive)}>
              Daily performance
            </NavLink>
          
          </nav>
          {!hideDateFilters ? (
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5 border-t border-slate-200/80 pt-2 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
              <NaturalGasAnalyticsToolbar />
            </div>
          ) : null}
        </div>
      </div>
      {children}
    </>
  );
};
