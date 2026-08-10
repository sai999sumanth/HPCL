// Create a new file called ManualBayReassignSection.jsx or add this to your existing file

import React, { useState } from "react";
import ManualFanPrintedTrendChart from "../../TASDashboards/BCUCriticalParameter/ManualFanPrintedTrendChart";
import { HostManualFanPrint } from "./HostManualFanPrint";

const ManualFanPrintSection = ({ filters, zone, plant, filterPortalId }) => { 
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
      <ManualFanPrintedTrendChart
        filters={filters} 
        onDateFilterChange={handleDateFilterChange}
        onChartFilterChange={handleChartFilterChange}
        filterPortalId={filterPortalId}
      />

      {dateFilter !== null && (
        <HostManualFanPrint
          zone={zone} 
          plant={plant} 
          dateFilter={dateFilter}
          chartFilterDate={chartFilterDate}
        />
      )}
    </>
  );
};

export default ManualFanPrintSection;