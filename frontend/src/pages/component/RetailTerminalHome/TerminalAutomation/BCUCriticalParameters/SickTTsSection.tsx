// Create a new file called ManualBayReassignSection.jsx or add this to your existing file

import React, { useState } from "react";
import HostSickTts from "./HostSickTts";
import SickTTSTrendChart from "../../TASDashboards/BCUCriticalParameter/SickTTSTrendChart";

const SickTTsSection = ({ filters, zone, plant, filterPortalId }) => { 
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
      <SickTTSTrendChart
        filters={filters} 
        onDateFilterChange={handleDateFilterChange} 
        onBcuFilterChange={handleBcuFilterChange}
        onChartFilterChange={handleChartFilterChange}
        filterPortalId={filterPortalId}
      />

      {dateFilter !== null && (
        <HostSickTts
          zone={zone} 
          plant={plant} 
          dateFilter={dateFilter} 
          bcuQuery={bcuQuery}
          chartFilterDate={chartFilterDate}
        />
      )}
    </>
  );
};

export default SickTTsSection;