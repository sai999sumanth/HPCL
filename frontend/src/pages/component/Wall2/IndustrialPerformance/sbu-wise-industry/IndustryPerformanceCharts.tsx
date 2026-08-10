
import React, { useState, useEffect } from "react";
import {
  fetchIndustryAreaChartData,
  fetchIndustryData,
  fetchProductLevelHeatmapData,
  fetchSbuLevelHeatmapData,
} from "../industryperformanceapi";
import AreaChart from "../charts/areachartamcharts";
import IndustryPerformanceGrid from "../IndustryGridTable";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/@/components/ui/tabs";
import { apiClient } from "@/services/apiClient";
import PerformersPage from "./PerformersPage";
import SbuWiseDynamicPieBarChart from "./industrypage/sbuWiseDynamicPieBarChart";
import SbuWiseAreaChart from "./industrypage/sbuWiseAreaChart";
import SbuWiseIndustryPerformanceGrid from "./industrypage/sbuWiseIndustryPerformanceGrid";

interface FilterValues {
  product: string;
  zone: string;
  startMonth: number;
  endMonth: number;
  year: number;
}

interface IndustryPerformanceChartsProps {
  sbu: string;
}

const IndustryPerformaceCharts: React.FC<IndustryPerformanceChartsProps> = ({ sbu }) => {
  const [chartData, setChartData] = useState<any>(null);
  const [areaChartData, setAreaChartData] = useState<any>(null);
  const [sbuHeatmapData, setSbuHeatmapData] = useState<any>(null);
  const [productHeatmapData, setProductHeatmapData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState({});
  const [industryData, setIndustryData] = useState(null);
  const [filterValues, setFilterValues] = useState<FilterValues | {}>({});

  const handleDataFetch = (data: any) => {
    setIndustryData(data);
  };
  // useEffect(() => {
  //   const loadData = async () => {
  //     try {
  //       const [pieData, areaData, sbuData, productData] = await Promise.all([
  //         fetchIndustryData(),
  //         fetchIndustryAreaChartData(true),
  //         fetchSbuLevelHeatmapData(),
  //         fetchProductLevelHeatmapData(),
  //       ]);

  //       setChartData(pieData);
  //       setAreaChartData(areaData);
  //       setSbuHeatmapData(sbuData);
  //       setProductHeatmapData(productData);
  //     } catch (err) {
  //       setError(err instanceof Error ? err.message : "An error occurred");
  //     } finally {
  //       setLoading(false);
  //     }
  //   };

  //   fetchData();
  //   loadData();
  // }, [sbu]); // Add sbu as dependency to refetch when sbu changes

  // const fetchData = async () => {
  //   try {
  //     let params = {
  //       filters: [
  //         {
  //           key: '"fiscal_year"',
  //           cond: "in",
  //           value: "2023-2024,2024-2025",
  //         },
  //         {
  //           key: '"YTM"',
  //           cond: "equals",
  //           value: "true",
  //         },
  //         {
  //           key: '"sbu_name"',
  //           cond: "equals",
  //           value: sbu || "AVIATION,I&C,LPG,LUBES,NG,RETAIL", // Use the passed sbu prop or fallback to all SBUs
  //         },
  //         {
  //           key: '"company_name"',
  //           cond: "in",
  //           value: "HPCL,BPCL,IOCL,GAIL,CPCL,MRPL,NRL,OIL,ONGC",
  //         },
  //       ],
  //       cross_filters: [],
  //       action: "industry_performance",
  //       drill_state: "",
  //       time_grain: "Monthly",
  //       resp_format: "company_level",
  //     };

  //     const response = await apiClient.post("/api/charts/generate_vis_data", params);

  //     if (!response.status) throw new Error("Network response was not ok");
  //     const result = await response.data;
  //     setData(result.data);
  //   } catch (error) {
  //     // console.error("Error fetching data:", error);
  //   } finally {
  //   }
  // };

  const handleFilterChange = (values: FilterValues) => {
    setFilterValues(values);
    // Here you would pass values to your chart components
  };

  return (
    <>
      <Tabs defaultValue="industryPerformance" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-blue-100/50">
          <TabsTrigger value="industryPerformance" className="">
            Industry Performance: {sbu || 'ALL'}
          </TabsTrigger>
          <TabsTrigger value="industryInsights">
            Industry Insights: {sbu || 'ALL'}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="industryPerformance" className="bg-blue-200">
          <div className="grid grid-cols-1 md:grid-cols-1 gap-1 p-0">
            {/* <DynamicPieBarChart /> */}
            <SbuWiseDynamicPieBarChart sbu={sbu} />
          </div>
          <div className="grid grid-cols-1 gap-1 p-0 pt-1">
            {/* <AreaChart /> */}
            {/* <IndustryPerformanceGrid /> */}
            <SbuWiseAreaChart sbu={sbu} />
            <SbuWiseIndustryPerformanceGrid sbu={sbu} />
          </div>
        </TabsContent>
        <TabsContent value="industryInsights">
          <PerformersPage sbu={sbu} />
        </TabsContent>
      </Tabs>
    </>
  );
};

export default IndustryPerformaceCharts;
