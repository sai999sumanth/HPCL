// Create a new file called ManualBayReassignSection.jsx or add this to your existing file

import React, { useState } from "react";
import HostBayReassignment from "./HostBayReassignment";
import BayReassignmentTrendChart from "../../TASDashboards/BCUCriticalParameter/BayReassignmentTrendChart";

const BayReassignSection = ({ filters, zone, plant, filterPortalId }) => { 
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [bcuQuery, setBcuQuery] = useState("");
  // When user clicks a dot on the chart, filter below table by that date/month
  const [chartPointFilter, setChartPointFilter] = useState(null);

  const handleDateFilterChange = (sqlDateFilter) => { 
    setDateFilter(sqlDateFilter);
  };
  const handleBcuFilterChange = (sqlBcuQuery) => { 
    setBcuQuery(sqlBcuQuery);
  };

  return ( 
    <>
      <BayReassignmentTrendChart
        filters={filters} 
        onDateFilterChange={handleDateFilterChange} 
        onBcuFilterChange={handleBcuFilterChange}
        onChartPointFilterChange={setChartPointFilter}
        filterPortalId={filterPortalId}
      />

      {dateFilter !== null && (
        <HostBayReassignment
          zone={zone} 
          plant={plant} 
          dateFilter={dateFilter} 
          bcuQuery={bcuQuery}
          pointDateFilter={chartPointFilter}
        />
      )}
    </>
  );
};

export default BayReassignSection;