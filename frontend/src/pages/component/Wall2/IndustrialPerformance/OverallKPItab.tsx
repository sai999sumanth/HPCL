import React, { useState, useEffect } from "react";
import {
  fetchIndustryAreaChartData,
  fetchSbuLevelHeatmapData,
} from "./industryperformanceapi";
import AreaChart from "./charts/areachartamcharts";
import IndustryPerformanceGrid from "./IndustryGridTable";
import IndustryDonutCharts from "./charts/CustomisedPieBarChart";
import { apiClient } from "@/services/apiClient";

const OverallKPItab: React.FC = () => {
  const [chartData, setChartData] = useState<any>(null);
  const [areaChartData, setAreaChartData] = useState<any>(null);
  const [sbuHeatmapData, setSbuHeatmapData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState({});

  useEffect(() => {
    const loadData = async () => {
      try {
        const [areaData, sbuData] = await Promise.all([
          fetchIndustryAreaChartData(true),
          fetchSbuLevelHeatmapData(),
        ]);

        // setChartData(pieData);
        setAreaChartData(areaData);
        setSbuHeatmapData(sbuData);
        // setProductHeatmapData(productData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    loadData();
  }, []);

  const fetchData = async () => {
    try {
      let params = {
        filters: [
          {
            key: '"fiscal_year"',
            cond: "in",
            value: "2024-2025,2025-2026",
          },
          {
            key: '"YTM"',
            cond: "equals",
            value: "true",
          },
          // {
          //   "key": "\"inc\"",
          //   "cond": "equals",
          //   "value": "true"
          // },
          {
            key: '"sbu_name"',
            cond: "equals",
            value: "AVIATION,I&C,LPG,LUBES,NG,RETAIL",
          },
          {
            key: '"company_name"',
            cond: "in",
            value: "HPCL,BPCL,IOCL,GAIL,CPCL,MRPL,NRL,OIL,ONGC",
          },
        ],
        cross_filters: [],
        action: "industry_performance",
        drill_state: "",
        time_grain: "Monthly",
        resp_format: "company_level",
      };

      const response = await apiClient.post("/api/charts/generate_vis_data", params);

      if (!response.status) throw new Error("Network response was not ok");
      const result = await response.data;
      setData(result.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
    }
  };

  // if (loading) return <div className="text-center p-4">Loading...</div>;
  // if (error)
  //   return <div className="text-center text-red-500 p-4">Error: {error}</div>;

  // Check if chartData exists and has the expected structure before rendering
  const hasValidData =
    chartData &&
    chartData["2023-2024"] &&
    chartData["2023-2024"].MPSU &&
    chartData["2023-2024"].PSU &&
    chartData["2023-2024"]["PSU+PVT"] &&
    chartData["growth_percentage"] &&
    chartData["growth_percentage"].MPSU &&
    chartData["growth_percentage"].PSU &&
    chartData["growth_percentage"]["PSU+PVT"];

  // if (!hasValidData) {
  //   return (
  //     <div className="text-center p-4">
  //       No data available or invalid data structure
  //     </div>
  //   );
  // }

  // Format data for growth bar charts
  const formatGrowthData = (sector) => {
    const sectorData = chartData?.["growth_percentage"][sector];
    return {
      [sector]: sectorData,
    };
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-1 gap-1 p-0">
        {/* <HtmlRenderer/> */}
        {/* <PerformanceControls onDataFetch={handleDataFetch} /> */}
        <IndustryDonutCharts />
      </div>

      {/* Growth Bar Charts */}
      {/* <h3 className="text-sm font-bold pt-2">
        Market Share G/L 2024-25 (Apr 2024 - Feb 2025)
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-1 p-0 pt-1">
        <GrowthBarChart data={mpsuGrowthData} title="Major OMC" />
        <GrowthBarChart data={otherPSUGrowthData} title="PSU" />
        <GrowthBarChart data={pvtGrowthData} title="PSU+PVT" />
      </div> */}
      {/* <div className="grid grid-cols-1 gap-1 p-0 pt-2">
        <CompanyWiseMarketshareChart />
      </div> */}
      <div className="grid grid-cols-1 gap-1 p-0 pt-1">
        <AreaChart />
        {/* <SbuPerformance/> */}
        {/* <CompanyPerformanceGrid /> */}
        <IndustryPerformanceGrid />
      </div>
    </>
  );
};

export default OverallKPItab;
