import React, { useState, useEffect } from 'react';
import {
  fetchIndustryData,
  fetchSbuLevelHeatmapData,
  fetchProductLevelHeatmapData
} from './industryperformanceapi';
import IndustryHeatmap from './charts/sbulevelheatmap';
import ProductHeatmap from './charts/Productlevelheatmap';
import CompanyPerformanceGrid from '../CompanyPerformanceSBUGrid';

const SBUWiseKPITab: React.FC = () => {
  const [chartData, setChartData] = useState<any>(null);
  const [sbuHeatmapData, setSbuHeatmapData] = useState<any>(null);
  const [productHeatmapData, setProductHeatmapData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [industryData, sbuData, productData] = await Promise.all([
          fetchIndustryData(),
          fetchSbuLevelHeatmapData(),
          fetchProductLevelHeatmapData()
        ]);

        setChartData(industryData);
        setSbuHeatmapData(sbuData);
        setProductHeatmapData(productData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

 

  if (loading) return <div className="text-center p-4">Loading...</div>;
  if (error) return <div className="text-center text-red-500 p-4">Error: {error}</div>;
  if (!chartData || !sbuHeatmapData || !productHeatmapData) {
    return <div className="text-center p-4">No data available</div>;
  }

  return (
    <>
        <div className="grid grid-cols-1 gap-1 p-0 pt-1">
          <CompanyPerformanceGrid />
          <IndustryHeatmap
            initialData={sbuHeatmapData}
            companies={chartData?.company || []}
          />
          <ProductHeatmap
            initialData={productHeatmapData}
            companies={chartData?.company || []}
          />
        </div>
    </>
  );
};

export default SBUWiseKPITab;