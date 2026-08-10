import React from "react";

/** Legacy accent — shared filters / buttons may still reference blue */
export const NG_PRIMARY = "#2b59c3";

/** Bordered white panel — no header row (tab name is enough). */
export const NaturalGasDashboardShell: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => (
    <div className="space-y-1 p-1 sm:p-1">{children}</div>
);
