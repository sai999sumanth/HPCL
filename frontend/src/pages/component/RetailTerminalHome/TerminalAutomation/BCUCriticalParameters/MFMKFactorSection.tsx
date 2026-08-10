// Create a new file called ManualBayReassignSection.jsx or add this to your existing file

import React, { useState } from "react";
import HostMFMKFactor from "./HostMFMKFactor";
import MFMKFactorTrendlineChart from "../../TASDashboards/BCUCriticalParameter/MFMKFactorTrendChart";

const MFMKFactorSection = ({ filters, zone, plant, filterPortalId }) => { 
  const [dateFilter, setDateFilter] = useState(null);
  const [bcuQuery, setBcuQuery] = useState("");
  const [chartFilterDate, setChartFilterDate] = useState<string | null>(null);

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
      <MFMKFactorTrendlineChart
        filters={filters} 
        onDateFilterChange={handleDateFilterChange} 
        onBcuFilterChange={handleBcuFilterChange}
        onChartFilterChange={handleChartFilterChange}
        filterPortalId={filterPortalId}
      />

      {dateFilter !== null && (
        <HostMFMKFactor
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

export default MFMKFactorSection;