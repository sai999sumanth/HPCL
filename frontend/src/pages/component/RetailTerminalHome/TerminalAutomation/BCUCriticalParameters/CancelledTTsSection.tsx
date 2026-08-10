// Create a new file called ManualBayReassignSection.jsx or add this to your existing file

import React, { useState } from "react";
import HostCancelledTts from "./HostCancelledTts";
import CancelledTTSTrendChart from "../../TASDashboards/BCUCriticalParameter/CancelledTTSTrendChart";

const CancelledTTsSection = ({ filters, zone, plant, filterPortalId }) => { 
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [bcuQuery, setBcuQuery] = useState("");
  const [chartFilterDate, setChartFilterDate] = useState<string | null>(null);
  
  
  // Function to receive date filter from chart component
  const handleDateFilterChange = (sqlDateFilter) => { 
    setDateFilter(sqlDateFilter);
  };
  const handleBcuFilterChange = (sqlBcuQuery) => { 
    setBcuQuery(sqlBcuQuery);
  };
  const handleChartFilterChange = (filterDate: string | null) => {
    setChartFilterDate(filterDate);
  };

  
  return ( 
    <>
      {/* Pass handler to chart component */}
      <CancelledTTSTrendChart
        filters={filters} 
        onDateFilterChange={handleDateFilterChange}
        onChartFilterChange={handleChartFilterChange}
        filterPortalId={filterPortalId}
      />

      {dateFilter !== null && (
        <HostCancelledTts
          zone={zone} 
          plant={plant} 
          dateFilter={dateFilter}
          chartFilterDate={chartFilterDate}
        />
      )}
    </>
  );
};

export default CancelledTTsSection;