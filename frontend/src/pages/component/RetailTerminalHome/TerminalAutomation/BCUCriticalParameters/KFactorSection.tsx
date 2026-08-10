
import React, { useState } from "react";
import HostKfactor from "./HostKfactor";
import KFactorTrendChart from "../../TASDashboards/BCUCriticalParameter/KFactorTrendChart";

const KFactorSection = ({ filters, zone, plant, filterPortalId }) => { 
  const [dateFilter, setDateFilter] = useState(null);
  const [bcuQuery, setBcuQuery] = useState("");
  const [activeChartTab, setActiveChartTab] = useState(0);

  const handleDateFilterChange = (sqlDateFilter) => { 
    setDateFilter(sqlDateFilter);
  };
  const handleBcuFilterChange = (sqlBcuQuery) => { 
    setBcuQuery(sqlBcuQuery);
  };

  return ( 
    <>
      <KFactorTrendChart
        filters={filters}
        zone={zone}
        plant={plant}
        onDateFilterChange={handleDateFilterChange}
        onBcuFilterChange={handleBcuFilterChange}
        onActiveTabChange={setActiveChartTab}
        filterPortalId={filterPortalId}
      />

      {activeChartTab === 0 && dateFilter !== null && (
        <HostKfactor
          zone={zone} 
          plant={plant} 
          dateFilter={dateFilter} 
          bcuQuery={bcuQuery} 
        />
      )}
    </>
  );
};

export default KFactorSection;