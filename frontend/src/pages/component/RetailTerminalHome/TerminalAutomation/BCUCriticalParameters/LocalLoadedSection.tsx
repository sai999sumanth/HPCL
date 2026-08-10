// Create a new file called LocalLoadedSection.jsx or add this to your existing file

import React, { useState } from "react";
import BCUAlertTrendChart from "../../TASDashboards/BCUCriticalParameter/BCULoading";
import { HostLocalLoadedTts } from "./HostLocalLoadedTts";

const LocalLoadedSection = ({ filters, zone, plant, filterPortalId }) => { 
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
  const handleChartFilterChange = (filterDate) => {
    setChartFilterDate(filterDate);
  };

  return ( 
    <>
      {/* Pass handler to chart component */}
      <BCUAlertTrendChart 
        filters={filters} 
        onDateFilterChange={handleDateFilterChange} 
        onBcuFilterChange={handleBcuFilterChange}
        onChartFilterChange={handleChartFilterChange}
        filterPortalId={filterPortalId}
      />
      
      {dateFilter !== null && (
        <HostLocalLoadedTts  
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

export default LocalLoadedSection;